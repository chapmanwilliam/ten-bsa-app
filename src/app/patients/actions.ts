'use server';

import { createClient } from '@/lib/supabase/server';
import { translateText } from '@/lib/translate';
import type { Site, Database } from '@/lib/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];
type Assessment = Database['public']['Tables']['assessments']['Row'];

export async function listPatients(): Promise<Patient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Patient[];
}

export async function getPatient(studyId: string): Promise<Patient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('study_id', studyId)
    .single();

  if (error) return null;
  return data as Patient;
}

export async function createPatient(formData: {
  studyId: string;
  initials: string;
  dateOfBirth: string;
  site: Site;
}) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('patients').insert({
    study_id: formData.studyId,
    initials: formData.initials.toUpperCase(),
    date_of_birth: formData.dateOfBirth,
    site: formData.site,
    created_by: user.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'A patient with this Study ID already exists.' };
    }
    return { error: error.message };
  }

  return { success: true };
}

export async function getPatientAssessments(
  patientId: string,
): Promise<Assessment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('assessment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Assessment[];
}

export async function getPatientAssessmentCount(
  patientId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('assessments')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('is_deleted', false);

  if (error) return 0;
  return count ?? 0;
}

export async function getLatestAssessments(): Promise<
  Record<string, Assessment>
> {
  const supabase = await createClient();

  // Get all non-deleted assessments, ordered by date desc
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('is_deleted', false)
    .order('assessment_date', { ascending: false });

  if (error) throw new Error(error.message);

  // Group by patient_id, keep only the latest one
  const latest: Record<string, Assessment> = {};
  for (const a of (data ?? []) as Assessment[]) {
    if (!latest[a.patient_id]) {
      latest[a.patient_id] = a;
    }
  }
  return latest;
}

export async function getAssessmentImageUrls(
  assessments: Assessment[],
): Promise<Record<string, { anterior: string | null; posterior: string | null }>> {
  const supabase = await createClient();
  const result: Record<string, { anterior: string | null; posterior: string | null }> = {};

  // Collect all paths that need signed URLs
  const pathsToSign: { assessmentId: string; view: 'anterior' | 'posterior'; path: string }[] = [];

  for (const a of assessments) {
    if (a.canvas_composite) {
      pathsToSign.push({ assessmentId: a.id, view: 'anterior', path: a.canvas_composite });
      // Derive posterior path from anterior path
      const posteriorPath = a.canvas_composite.replace('composite-anterior.png', 'composite-posterior.png');
      pathsToSign.push({ assessmentId: a.id, view: 'posterior', path: posteriorPath });
    }
  }

  if (pathsToSign.length === 0) return result;

  // Create signed URLs (valid for 1 hour)
  const allPaths = pathsToSign.map((p) => p.path);
  const { data, error } = await supabase.storage
    .from('canvas-images')
    .createSignedUrls(allPaths, 3600);

  if (error || !data) return result;

  // Map signed URLs back to assessments
  for (let i = 0; i < pathsToSign.length; i++) {
    const { assessmentId, view } = pathsToSign[i];
    const signedUrl = data[i]?.signedUrl ?? null;
    if (!result[assessmentId]) {
      result[assessmentId] = { anterior: null, posterior: null };
    }
    result[assessmentId][view] = signedUrl;
  }

  return result;
}

export async function getPreviousAssessmentMaps(
  patientId: string,
): Promise<{
  date: string;
  anteriorTbsa: string | null;
  anteriorDbsa: string | null;
  posteriorTbsa: string | null;
  posteriorDbsa: string | null;
} | null> {
  const supabase = await createClient();

  // Get the most recent assessment for this patient
  const { data, error } = await supabase
    .from('assessments')
    .select('assessment_date, canvas_anterior_tbsa, canvas_anterior_dbsa, canvas_posterior_tbsa, canvas_posterior_dbsa')
    .eq('patient_id', patientId)
    .eq('is_deleted', false)
    .order('assessment_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const a = data as {
    assessment_date: string;
    canvas_anterior_tbsa: string | null;
    canvas_anterior_dbsa: string | null;
    canvas_posterior_tbsa: string | null;
    canvas_posterior_dbsa: string | null;
  };

  // Collect paths that exist
  const paths: string[] = [];
  const keys: ('anteriorTbsa' | 'anteriorDbsa' | 'posteriorTbsa' | 'posteriorDbsa')[] = [];
  const pathMap: Record<string, string | null> = {
    anteriorTbsa: a.canvas_anterior_tbsa,
    anteriorDbsa: a.canvas_anterior_dbsa,
    posteriorTbsa: a.canvas_posterior_tbsa,
    posteriorDbsa: a.canvas_posterior_dbsa,
  };

  for (const [key, path] of Object.entries(pathMap)) {
    if (path) {
      paths.push(path);
      keys.push(key as typeof keys[number]);
    }
  }

  if (paths.length === 0) return null;

  // Create signed URLs (valid for 1 hour)
  const { data: signedData, error: signError } = await supabase.storage
    .from('canvas-images')
    .createSignedUrls(paths, 3600);

  if (signError || !signedData) return null;

  const result: Record<string, string | null> = {
    anteriorTbsa: null,
    anteriorDbsa: null,
    posteriorTbsa: null,
    posteriorDbsa: null,
  };

  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = signedData[i]?.signedUrl ?? null;
  }

  return {
    date: a.assessment_date,
    anteriorTbsa: result.anteriorTbsa,
    anteriorDbsa: result.anteriorDbsa,
    posteriorTbsa: result.posteriorTbsa,
    posteriorDbsa: result.posteriorDbsa,
  };
}

export async function submitAssessment(payload: {
  patientId: string;
  tbsaPercent: number;
  dbsaPercent: number;
  tbsaRegions: Record<string, number>;
  dbsaRegions: Record<string, number>;
  notes: string;
  notesLanguage: 'en' | 'fr';
  albuminLevel: number | null;
  photos: { dataUrl: string; fileName: string; fileSize: number; mimeType: string; caption: string; metadata?: Record<string, unknown> | null }[];
  canvasImages: {
    anteriorTbsa: string; // data URL
    anteriorDbsa: string;
    posteriorTbsa: string;
    posteriorDbsa: string;
    compositeAnterior: string;
    compositePosterior: string;
  };
  // SCORTEN — only included for first assessment
  scorten?: {
    score: number;
    ageGte40: boolean;
    hrGte120: boolean;
    malignancy: boolean;
    bsaGte10: boolean;
    ureaGt10: boolean;
    bicarbLt20: boolean;
    glucoseGt14: boolean;
  } | null;
}) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Upload image to storage
  const uploadImage = async (
    dataUrl: string,
    path: string,
    contentType = 'image/png',
  ): Promise<string | null> => {
    try {
      // Convert data URL to Uint8Array
      const base64 = dataUrl.split(',')[1];
      const binaryStr = Buffer.from(base64, 'base64');

      const { error } = await supabase.storage
        .from('canvas-images')
        .upload(path, binaryStr, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error(`Upload error for ${path}:`, error.message);
        return null;
      }
      return path;
    } catch (e) {
      console.error(`Upload exception for ${path}:`, e);
      return null;
    }
  };

  const timestamp = Date.now();
  const basePath = `${payload.patientId}/${timestamp}`;

  // Upload all canvas images in parallel
  const [
    anteriorTbsaPath,
    anteriorDbsaPath,
    posteriorTbsaPath,
    posteriorDbsaPath,
    compositeAnteriorPath,
  ] = await Promise.all([
    uploadImage(
      payload.canvasImages.anteriorTbsa,
      `${basePath}/anterior-tbsa.png`,
    ),
    uploadImage(
      payload.canvasImages.anteriorDbsa,
      `${basePath}/anterior-dbsa.png`,
    ),
    uploadImage(
      payload.canvasImages.posteriorTbsa,
      `${basePath}/posterior-tbsa.png`,
    ),
    uploadImage(
      payload.canvasImages.posteriorDbsa,
      `${basePath}/posterior-dbsa.png`,
    ),
    uploadImage(
      payload.canvasImages.compositeAnterior,
      `${basePath}/composite-anterior.png`,
    ),
    uploadImage(
      payload.canvasImages.compositePosterior,
      `${basePath}/composite-posterior.png`,
    ),
  ]);

  // Translate notes if present (non-blocking — translation failure doesn't block submission)
  let notesTranslation: string | null = null;
  if (payload.notes?.trim()) {
    const targetLang = payload.notesLanguage === 'en' ? 'fr' : 'en';
    notesTranslation = await translateText(
      payload.notes,
      payload.notesLanguage,
      targetLang as 'en' | 'fr',
    );
  }

  // Insert assessment record (with .select('id') to get the new ID for photo linking)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assessmentData, error } = await (supabase as any).from('assessments').insert({
    patient_id: payload.patientId,
    clinician_id: user.id,
    tbsa_percent: payload.tbsaPercent,
    dbsa_percent: payload.dbsaPercent,
    tbsa_regions: payload.tbsaRegions,
    dbsa_regions: payload.dbsaRegions,
    canvas_anterior_tbsa: anteriorTbsaPath,
    canvas_anterior_dbsa: anteriorDbsaPath,
    canvas_posterior_tbsa: posteriorTbsaPath,
    canvas_posterior_dbsa: posteriorDbsaPath,
    canvas_composite: compositeAnteriorPath
      ? `${basePath}/composite-anterior.png`
      : null,
    albumin_level: payload.albuminLevel,
    notes: payload.notes || null,
    notes_language: payload.notes?.trim() ? payload.notesLanguage : null,
    notes_translation: notesTranslation,
    assessment_date: new Date().toISOString(),
    // SCORTEN (first assessment only)
    ...(payload.scorten ? {
      scorten_score: payload.scorten.score,
      scorten_age_gte40: payload.scorten.ageGte40,
      scorten_hr_gte120: payload.scorten.hrGte120,
      scorten_malignancy: payload.scorten.malignancy,
      scorten_bsa_gte10: payload.scorten.bsaGte10,
      scorten_urea_gt10: payload.scorten.ureaGt10,
      scorten_bicarb_lt20: payload.scorten.bicarbLt20,
      scorten_glucose_gt14: payload.scorten.glucoseGt14,
    } : {}),
  }).select('id').single();

  if (error) {
    return { error: error.message };
  }

  // Upload photos if any
  if (payload.photos.length > 0 && assessmentData?.id) {
    const assessmentId = assessmentData.id as string;

    for (let i = 0; i < payload.photos.length; i++) {
      const photo = payload.photos[i];
      const ext = photo.mimeType.includes('png') ? 'png' : 'jpg';
      const photoPath = `${basePath}/photos/photo-${i}.${ext}`;

      const uploadedPath = await uploadImage(photo.dataUrl, photoPath, photo.mimeType);

      if (uploadedPath) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('assessment_photos').insert({
          assessment_id: assessmentId,
          storage_path: uploadedPath,
          file_name: photo.fileName,
          file_size: photo.fileSize,
          mime_type: photo.mimeType,
          caption: photo.caption || null,
          sort_order: i,
          uploaded_by: user.id,
          metadata: photo.metadata || null,
        });
      }
    }
  }

  return { success: true };
}

type AssessmentPhoto = Database['public']['Tables']['assessment_photos']['Row'];

export async function getAssessmentPhotos(
  assessmentIds: string[],
): Promise<Record<string, AssessmentPhoto[]>> {
  if (assessmentIds.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessment_photos')
    .select('*')
    .in('assessment_id', assessmentIds)
    .order('sort_order', { ascending: true });

  if (error) return {};

  const result: Record<string, AssessmentPhoto[]> = {};
  for (const photo of (data ?? []) as AssessmentPhoto[]) {
    if (!result[photo.assessment_id]) {
      result[photo.assessment_id] = [];
    }
    result[photo.assessment_id].push(photo);
  }
  return result;
}

export async function getPhotoUrls(
  photos: AssessmentPhoto[],
): Promise<Record<string, string>> {
  if (photos.length === 0) return {};

  const supabase = await createClient();
  const paths = photos.map((p) => p.storage_path);
  const { data, error } = await supabase.storage
    .from('canvas-images')
    .createSignedUrls(paths, 3600);

  if (error || !data) return {};

  const result: Record<string, string> = {};
  for (let i = 0; i < photos.length; i++) {
    const signedUrl = data[i]?.signedUrl;
    if (signedUrl) {
      result[photos[i].id] = signedUrl;
    }
  }
  return result;
}
