'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role, Site, Database } from '@/lib/supabase/types';

type Clinician = Database['public']['Tables']['clinicians']['Row'];

export async function getCurrentClinician(): Promise<Clinician | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('clinicians')
    .select('*')
    .eq('id', user.id)
    .single();

  return data as Clinician | null;
}

export async function listClinicians(): Promise<Clinician[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('clinicians')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Clinician[];
}

export async function createClinician(formData: {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  site: Site;
}) {
  // Verify current user is admin/PI
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return { error: 'Unauthorized' };
  }

  const admin = createAdminClient();

  // Create auth user (bypasses signup disabled)
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true,
    });

  if (authError) {
    return { error: authError.message };
  }

  // Create clinician record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: clinicianError } = await (admin as any).from('clinicians').insert({
    id: authData.user.id,
    email: formData.email,
    full_name: formData.fullName,
    role: formData.role,
    site: formData.site,
    is_active: true,
  });

  if (clinicianError) {
    // Rollback: delete the auth user if clinician record fails
    await admin.auth.admin.deleteUser(authData.user.id);
    return { error: clinicianError.message };
  }

  return { success: true };
}

export async function toggleClinicianActive(clinicianId: string, isActive: boolean) {
  // Verify current user is admin/PI
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return { error: 'Unauthorized' };
  }

  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('clinicians')
    .update({ is_active: isActive })
    .eq('id', clinicianId);

  if (error) return { error: error.message };
  return { success: true };
}

/* ─── Phase 5: Admin Dashboard Actions ─── */

export interface PatientOverviewRow {
  id: string;
  study_id: string;
  initials: string;
  site: Site;
  assessment_count: number;
  latest_tbsa: number | null;
  latest_dbsa: number | null;
  scorten_score: number | null;
  last_assessment_date: string | null;
}

export async function getPatientOverview(): Promise<PatientOverviewRow[]> {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return [];
  }

  const supabase = await createClient();

  // Get all patients
  const { data: patientsData, error: pErr } = await supabase
    .from('patients')
    .select('*')
    .order('study_id', { ascending: true });

  if (pErr || !patientsData) return [];

  const patients = patientsData as Database['public']['Tables']['patients']['Row'][];

  // Get all assessments (non-deleted)
  const { data: assessmentsData } = await supabase
    .from('assessments')
    .select('id, patient_id, tbsa_percent, dbsa_percent, scorten_score, assessment_date, is_deleted')
    .eq('is_deleted', false)
    .order('assessment_date', { ascending: true });

  const allAssessments = (assessmentsData ?? []) as Database['public']['Tables']['assessments']['Row'][];

  return patients.map((p) => {
    const patientAssessments = allAssessments.filter((a) => a.patient_id === p.id);
    const latest = patientAssessments.length > 0 ? patientAssessments[patientAssessments.length - 1] : null;
    // SCORTEN comes from the first assessment
    const first = patientAssessments.length > 0 ? patientAssessments[0] : null;

    return {
      id: p.id,
      study_id: p.study_id,
      initials: p.initials,
      site: p.site as Site,
      assessment_count: patientAssessments.length,
      latest_tbsa: latest ? Number(latest.tbsa_percent) : null,
      latest_dbsa: latest ? Number(latest.dbsa_percent) : null,
      scorten_score: first?.scorten_score ?? null,
      last_assessment_date: latest?.assessment_date ?? null,
    };
  });
}

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by: string | null;
  performer_name: string | null;
  created_at: string;
}

export async function getAuditLog(params: {
  page: number;
  pageSize: number;
  tableFilter?: string;
}): Promise<{ entries: AuditLogEntry[]; totalCount: number }> {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return { entries: [], totalCount: 0 };
  }

  const supabase = await createClient();
  const { page, pageSize, tableFilter } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (tableFilter) {
    query = query.eq('table_name', tableFilter);
  }

  const { data: rawData, count, error } = await query;

  if (error || !rawData) return { entries: [], totalCount: 0 };

  type AuditRow = Database['public']['Tables']['audit_log']['Row'];
  const data = rawData as AuditRow[];

  // Fetch clinician names for performers
  const performerIds = [...new Set(data.map((d) => d.performed_by).filter(Boolean))] as string[];
  let clinicianMap: Record<string, string> = {};

  if (performerIds.length > 0) {
    const { data: clinicianData } = await supabase
      .from('clinicians')
      .select('id, full_name')
      .in('id', performerIds);

    if (clinicianData) {
      const typedClinicians = clinicianData as { id: string; full_name: string }[];
      clinicianMap = Object.fromEntries(typedClinicians.map((c) => [c.id, c.full_name]));
    }
  }

  const entries: AuditLogEntry[] = data.map((d) => ({
    id: d.id,
    table_name: d.table_name,
    record_id: d.record_id,
    action: d.action,
    old_data: d.old_data,
    new_data: d.new_data,
    performed_by: d.performed_by,
    performer_name: d.performed_by ? clinicianMap[d.performed_by] ?? null : null,
    created_at: d.created_at,
  }));

  return { entries, totalCount: count ?? 0 };
}

export interface ExportRow {
  study_id: string;
  initials: string;
  site: string;
  assessment_date: string;
  tbsa_percent: number;
  dbsa_percent: number;
  albumin_level: number | null;
  scorten_score: number | null;
  clinician_name: string;
  notes: string | null;
  notes_translation: string | null;
  tbsa_regions: Record<string, number>;
  dbsa_regions: Record<string, number>;
}

export async function getExportData(params: {
  siteFilter?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ExportRow[]> {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return [];
  }

  const supabase = await createClient();

  type PatientRow = Database['public']['Tables']['patients']['Row'];
  type AssessmentRow = Database['public']['Tables']['assessments']['Row'];

  // Get patients (with optional site filter)
  let patientQuery = supabase.from('patients').select('*');
  if (params.siteFilter) {
    patientQuery = patientQuery.eq('site', params.siteFilter);
  }
  const { data: patientsRaw } = await patientQuery;
  if (!patientsRaw || patientsRaw.length === 0) return [];

  const patients = patientsRaw as PatientRow[];
  const patientIds = patients.map((p) => p.id);
  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p]));

  // Get assessments
  let assessmentQuery = supabase
    .from('assessments')
    .select('*')
    .in('patient_id', patientIds)
    .eq('is_deleted', false)
    .order('assessment_date', { ascending: true });

  if (params.dateFrom) {
    assessmentQuery = assessmentQuery.gte('assessment_date', params.dateFrom);
  }
  if (params.dateTo) {
    assessmentQuery = assessmentQuery.lte('assessment_date', params.dateTo + 'T23:59:59');
  }

  const { data: assessmentsRaw } = await assessmentQuery;
  if (!assessmentsRaw || assessmentsRaw.length === 0) return [];

  const assessments = assessmentsRaw as AssessmentRow[];

  // Get clinician names
  const clinicianIds = [...new Set(assessments.map((a) => a.clinician_id))];
  const { data: clinicianDataRaw } = await supabase
    .from('clinicians')
    .select('id, full_name')
    .in('id', clinicianIds);

  const clinicianMap = Object.fromEntries(
    ((clinicianDataRaw ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name])
  );

  return assessments.map((a) => {
    const patient = patientMap[a.patient_id];
    return {
      study_id: patient?.study_id ?? '',
      initials: patient?.initials ?? '',
      site: patient?.site ?? '',
      assessment_date: a.assessment_date,
      tbsa_percent: Number(a.tbsa_percent),
      dbsa_percent: Number(a.dbsa_percent),
      albumin_level: a.albumin_level !== null ? Number(a.albumin_level) : null,
      scorten_score: a.scorten_score,
      clinician_name: clinicianMap[a.clinician_id] ?? '',
      notes: a.notes,
      notes_translation: a.notes_translation,
      tbsa_regions: (a.tbsa_regions ?? {}) as Record<string, number>,
      dbsa_regions: (a.dbsa_regions ?? {}) as Record<string, number>,
    };
  });
}

/* ─── Phase 6: MFA Management Actions ─── */

export interface ClinicianMfaStatus {
  clinicianId: string;
  hasMfa: boolean;
}

export async function getClinicianMfaStatuses(
  clinicianIds: string[]
): Promise<ClinicianMfaStatus[]> {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return [];
  }

  const admin = createAdminClient();
  const results: ClinicianMfaStatus[] = [];

  for (const id of clinicianIds) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data?.user) {
        results.push({ clinicianId: id, hasMfa: false });
        continue;
      }

      const factors = data.user.factors ?? [];
      const hasTotpEnrolled = factors.some(
        (f: { factor_type: string; status: string }) =>
          f.factor_type === 'totp' && f.status === 'verified'
      );
      results.push({ clinicianId: id, hasMfa: hasTotpEnrolled });
    } catch {
      results.push({ clinicianId: id, hasMfa: false });
    }
  }

  return results;
}

export async function resetClinicianPassword(clinicianId: string, newPassword: string) {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return { error: 'Unauthorized' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(clinicianId, {
    password: newPassword,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function resetClinicianMfa(clinicianId: string) {
  const currentUser = await getCurrentClinician();
  if (!currentUser || !['admin', 'pi'].includes(currentUser.role)) {
    return { error: 'Unauthorized' };
  }

  const admin = createAdminClient();

  try {
    // Get the user's MFA factors
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(clinicianId);

    if (userError || !userData?.user) {
      return { error: 'User not found' };
    }

    const factors = userData.user.factors ?? [];
    const totpFactors = factors.filter(
      (f: { factor_type: string }) => f.factor_type === 'totp'
    );

    if (totpFactors.length === 0) {
      return { error: 'No MFA factors to reset' };
    }

    // Delete each TOTP factor
    for (const factor of totpFactors) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: clinicianId,
      });

      if (deleteError) {
        return { error: deleteError.message };
      }
    }

    return { success: true };
  } catch (err) {
    return { error: 'Failed to reset MFA' };
  }
}
