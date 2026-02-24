'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ChangePasswordDialog } from '@/components/ui/ChangePasswordDialog';
import { PhotoLightbox } from '@/components/ui/PhotoLightbox';
import { TrendChart } from '@/components/charts/TrendChart';
import { createClient } from '@/lib/supabase/client';
import {
  getPatient,
  getPatientAssessments,
  getAssessmentImageUrls,
  getAssessmentPhotos,
  getPhotoUrls,
} from '../actions';
import { listClinicians } from '../../admin/actions';
import type { Database } from '@/lib/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];
type Assessment = Database['public']['Tables']['assessments']['Row'];
type Clinician = Database['public']['Tables']['clinicians']['Row'];
type AssessmentPhoto = Database['public']['Tables']['assessment_photos']['Row'];

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studyId = params.studyId as string;
  const t = useTranslations();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [clinicians, setClinicians] = useState<Record<string, Clinician>>({});
  const [imageUrls, setImageUrls] = useState<
    Record<string, { anterior: string | null; posterior: string | null }>
  >({});
  const [photos, setPhotos] = useState<Record<string, AssessmentPhoto[]>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<AssessmentPhoto | null>(null);

  useEffect(() => {
    async function load() {
      const p = await getPatient(studyId);
      if (!p) {
        router.push('/');
        return;
      }
      setPatient(p);

      const [assessmentList, clinicianList] = await Promise.all([
        getPatientAssessments(p.id),
        listClinicians(),
      ]);
      setAssessments(assessmentList);

      // Index clinicians by id
      const map: Record<string, Clinician> = {};
      for (const c of clinicianList) {
        map[c.id] = c;
      }
      setClinicians(map);

      // Fetch signed image URLs for composites + photos
      if (assessmentList.length > 0) {
        const [urls, photoMap] = await Promise.all([
          getAssessmentImageUrls(assessmentList),
          getAssessmentPhotos(assessmentList.map((a) => a.id)),
        ]);
        setImageUrls(urls);
        setPhotos(photoMap);

        // Flatten all photos and get signed URLs
        const allPhotos = Object.values(photoMap).flat();
        if (allPhotos.length > 0) {
          const pUrls = await getPhotoUrls(allPhotos);
          setPhotoUrls(pUrls);
        }
      }

      setLoading(false);
    }
    load();
  }, [studyId, router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] gap-3">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!patient) return null;

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <header className="bg-white border-b border-[#d0d0c8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-[#888] hover:text-[#333]"
          >
            {t('nav.backToPatients')}
          </button>
          <span className="text-xs text-[#aaa]">|</span>
          <h1 className="text-sm font-bold text-[#1a1a1a]">
            {patient.study_id}
          </h1>
          <span className="text-xs text-[#888]">({patient.initials})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswordDialog(true)}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
          >
            {t('nav.changePassword')}
          </button>
          <LanguageToggle />
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 text-xs text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4">
        {/* Patient info card */}
        <div className="bg-white rounded-xl border border-[#d0d0c8] p-4 mb-4">
          <h2 className="text-sm font-semibold text-[#555] mb-2">
            {t('patientDetail.patientInfo')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#999]">{t('patients.studyId')}</span>
              <p className="font-medium">{patient.study_id}</p>
            </div>
            <div>
              <span className="text-[#999]">{t('patients.initials')}</span>
              <p className="font-medium">{patient.initials}</p>
            </div>
            <div>
              <span className="text-[#999]">{t('patients.dob')}</span>
              <p className="font-medium">
                {formatDate(patient.date_of_birth)}
              </p>
            </div>
            <div>
              <span className="text-[#999]">{t('patients.site')}</span>
              <p className="font-medium">
                {t(`admin.sites.${patient.site}`)}
              </p>
            </div>
          </div>
        </div>

        {/* Trend chart (shows when ≥2 assessments) */}
        {assessments.length >= 2 && (
          <div className="mb-4">
            <TrendChart
              data={[...assessments].reverse().map((a) => ({
                date: a.assessment_date,
                tbsa: Number(a.tbsa_percent),
                dbsa: Number(a.dbsa_percent),
              }))}
            />
          </div>
        )}

        {/* Assessment history */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#555]">
            {t('patientDetail.assessmentHistory')} ({assessments.length})
          </h2>
          <button
            onClick={() => router.push(`/patients/${studyId}/assess`)}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#c95a8a] text-white
                       hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
          >
            + {t('patientDetail.newAssessment')}
          </button>
        </div>

        {assessments.length === 0 ? (
          <div className="text-center py-12 text-[#888] text-sm bg-white rounded-xl border border-[#d0d0c8]">
            {t('patientDetail.noAssessments')}
          </div>
        ) : (
          <div className="space-y-3">
            {assessments.map((a) => {
              const assessor = clinicians[a.clinician_id];
              const images = imageUrls[a.id];
              const assessmentPhotos = photos[a.id] || [];
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-[#d0d0c8] p-4"
                >
                  {/* Top row: percentages + meta */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-[#c95a8a] font-mono text-lg font-medium">
                          {Number(a.tbsa_percent).toFixed(1)}%
                        </span>
                        <span className="text-xs text-[#999]">
                          {t('patientDetail.tbsa')}
                        </span>
                        <span className="text-[#636e72] font-mono text-lg font-medium">
                          {Number(a.dbsa_percent).toFixed(1)}%
                        </span>
                        <span className="text-xs text-[#999]">
                          {t('patientDetail.dbsa')}
                        </span>
                        {a.albumin_level !== null && a.albumin_level !== undefined && (
                          <>
                            <span className="text-[#2d6a4f] font-mono text-lg font-medium">
                              {Number(a.albumin_level).toFixed(1)}
                            </span>
                            <span className="text-xs text-[#999]">
                              {t('patientDetail.albumin')} (g/L)
                            </span>
                          </>
                        )}
                      </div>
                      {/* SCORTEN badge */}
                      {a.scorten_score !== null && a.scorten_score !== undefined && (
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                            a.scorten_score >= 5 ? 'bg-red-100 text-red-700' :
                            a.scorten_score >= 3 ? 'bg-orange-100 text-orange-700' :
                            a.scorten_score >= 2 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {t('patientDetail.scorten')}: {a.scorten_score}/7
                          </span>
                          <span className="text-[10px] text-[#999]">
                            {t('patientDetail.scortenMortality')}:{' '}
                            {a.scorten_score >= 5 ? '90%' :
                             a.scorten_score === 4 ? '58.3%' :
                             a.scorten_score === 3 ? '35.3%' :
                             a.scorten_score === 2 ? '12.1%' : '3.2%'}
                          </span>
                        </div>
                      )}
                      <div className="text-xs text-[#999]">
                        <span>
                          {t('patientDetail.date')}:{' '}
                          {formatDateTime(a.assessment_date)}
                        </span>
                        {assessor && (
                          <span className="ml-3">
                            {t('patientDetail.assessedBy')}:{' '}
                            {assessor.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body map composites */}
                  {images && (images.anterior || images.posterior) && (
                    <div className="flex gap-3 justify-center bg-[#f8f8f5] rounded-lg p-3 mb-2">
                      {images.anterior && (
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">
                            {t('views.front')}
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={images.anterior}
                            alt="Anterior body map"
                            className="h-40 sm:h-52 w-auto rounded border border-[#e0e0d8]"
                          />
                        </div>
                      )}
                      {images.posterior && (
                        <div className="text-center">
                          <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">
                            {t('views.back')}
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={images.posterior}
                            alt="Posterior body map"
                            className="h-40 sm:h-52 w-auto rounded border border-[#e0e0d8]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clinical photographs */}
                  {assessmentPhotos.length > 0 && (
                    <div className="bg-[#f8f8f5] rounded-lg p-3 mb-2">
                      <p className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-2">
                        {t('patientDetail.photos')}
                      </p>
                      <div className="flex gap-2 overflow-x-auto">
                        {assessmentPhotos.map((photo) => {
                          const url = photoUrls[photo.id];
                          if (!url) return null;
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setLightboxPhoto(photo)}
                              className="flex-shrink-0 text-center cursor-pointer group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={photo.caption || photo.file_name}
                                className="h-24 sm:h-32 w-auto rounded border border-[#e0e0d8] group-hover:border-[#c95a8a] transition-colors"
                              />
                              {photo.caption && (
                                <p className="text-[9px] text-[#999] mt-0.5 max-w-[100px] truncate">
                                  {photo.caption}
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notes with translation */}
                  {a.notes && (
                    <div className="text-xs bg-[#f8f8f5] rounded-lg px-3 py-2 space-y-1.5">
                      <div>
                        <span className="font-semibold text-[#999] text-[10px] uppercase tracking-wide">
                          {t('patientDetail.notesOriginal')}
                          {a.notes_language ? ` (${a.notes_language.toUpperCase()})` : ''}
                        </span>
                        <p className="text-[#666] mt-0.5">{a.notes}</p>
                      </div>
                      {a.notes_translation && (
                        <div className="border-t border-[#e0e0d8] pt-1.5">
                          <span className="font-semibold text-[#999] text-[10px] uppercase tracking-wide">
                            {t('patientDetail.notesTranslation')}
                            {a.notes_language ? ` (${a.notes_language === 'en' ? 'FR' : 'EN'})` : ''}
                          </span>
                          <p className="text-[#666] mt-0.5 italic">{a.notes_translation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />

      {lightboxPhoto && photoUrls[lightboxPhoto.id] && (
        <PhotoLightbox
          photo={lightboxPhoto}
          url={photoUrls[lightboxPhoto.id]}
          uploadedBy={clinicians[lightboxPhoto.uploaded_by] ?? null}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
}
