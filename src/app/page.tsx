'use client';

import { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ChangePasswordDialog } from '@/components/ui/ChangePasswordDialog';
import { createClient } from '@/lib/supabase/client';
import {
  listPatients,
  createPatient,
  getLatestAssessments,
} from './patients/actions';
import { getCurrentClinician } from './admin/actions';
import type { Site, Database } from '@/lib/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];
type Assessment = Database['public']['Tables']['assessments']['Row'];
type Clinician = Database['public']['Tables']['clinicians']['Row'];

export default function PatientsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [latestAssessments, setLatestAssessments] = useState<
    Record<string, Assessment>
  >({});
  const [clinician, setClinician] = useState<Clinician | null>(null);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form state
  const [formStudyId, setFormStudyId] = useState('');
  const [formInitials, setFormInitials] = useState('');
  const [formDob, setFormDob] = useState('');
  const [formSite, setFormSite] = useState<Site>('france');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [user, patientList, latest] = await Promise.all([
      getCurrentClinician(),
      listPatients(),
      getLatestAssessments(),
    ]);
    setClinician(user);
    setPatients(patientList);
    setLatestAssessments(latest);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createPatient({
        studyId: formStudyId.trim(),
        initials: formInitials.trim(),
        dateOfBirth: formDob,
        site: formSite,
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({
          type: 'success',
          text: t('patients.dialog.success'),
        });
        setShowDialog(false);
        setFormStudyId('');
        setFormInitials('');
        setFormDob('');
        setFormSite('france');
        await loadData();
      }
    });
  }

  // Filter patients by search term
  const filtered = patients.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.study_id.toLowerCase().includes(q) ||
      p.initials.toLowerCase().includes(q)
    );
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  if (!clinician) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] gap-3">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <header className="bg-white border-b border-[#d0d0c8] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-[#1a1a1a]">
            {t('app.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {['admin', 'pi'].includes(clinician.role) && (
            <button
              onClick={() => router.push('/admin')}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
            >
              {t('nav.admin')}
            </button>
          )}
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

      <div className="max-w-4xl mx-auto p-4">
        {/* Message banner */}
        {message && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Title + add + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-[#1a1a1a]">
            {t('patients.title')}
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('patients.search')}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#d0d0c8] focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a] w-48"
            />
            <button
              onClick={() => setShowDialog(true)}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#c95a8a] text-white
                         hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors whitespace-nowrap"
            >
              + {t('patients.addPatient')}
            </button>
          </div>
        </div>

        {/* Patients table */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#888] text-sm">
            {patients.length === 0
              ? t('patients.noPatients')
              : 'No matching patients.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#d0d0c8] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f8f8f5] border-b border-[#d0d0c8]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[#555]">
                    {t('patients.studyId')}
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#555]">
                    {t('patients.initials')}
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#555] hidden sm:table-cell">
                    {t('patients.dob')}
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#555] hidden sm:table-cell">
                    {t('patients.site')}
                  </th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[#555]">
                    {t('patients.lastAssessment')}
                  </th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[#555]">
                    {t('admin.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const latest = latestAssessments[p.id];
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-[#eee] last:border-0 hover:bg-[#fafaf8] cursor-pointer"
                      onClick={() =>
                        router.push(`/patients/${p.study_id}`)
                      }
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {p.study_id}
                      </td>
                      <td className="px-4 py-2.5 text-[#666]">
                        {p.initials}
                      </td>
                      <td className="px-4 py-2.5 text-[#666] hidden sm:table-cell">
                        {formatDate(p.date_of_birth)}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {t(`admin.sites.${p.site}`)}
                      </td>
                      <td className="px-4 py-2.5">
                        {latest ? (
                          <span className="text-[#555]">
                            <span className="text-[#c95a8a] font-medium">
                              {Number(latest.tbsa_percent).toFixed(1)}%
                            </span>
                            {' / '}
                            <span className="text-[#636e72] font-medium">
                              {Number(latest.dbsa_percent).toFixed(1)}%
                            </span>
                            <span className="text-[#999] text-xs ml-2">
                              {formatDate(latest.assessment_date)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#bbb] text-xs">
                            {t('patients.never')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/patients/${p.study_id}/assess`,
                              );
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#c95a8a] text-white
                                       hover:bg-[#b44d7a] transition-colors"
                          >
                            {t('patients.newAssessment')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/patients/${p.study_id}`);
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-[#d0d0c8]
                                       hover:bg-[#f0f0ea] transition-colors"
                          >
                            {t('patients.viewHistory')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />

      {/* Add Patient Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold mb-4">
              {t('patients.dialog.title')}
            </h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('patients.dialog.studyId')}
                </label>
                <input
                  type="text"
                  required
                  value={formStudyId}
                  onChange={(e) => setFormStudyId(e.target.value)}
                  placeholder={t('patients.dialog.studyIdPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                />
                <p className="text-[10px] text-[#999] mt-1">
                  {t('patients.dialog.studyIdHelp')}
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#555] mb-1">
                    {t('patients.dialog.initials')}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={4}
                    value={formInitials}
                    onChange={(e) =>
                      setFormInitials(e.target.value.toUpperCase())
                    }
                    placeholder={t('patients.dialog.initialsPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm uppercase
                               focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                  />
                  <p className="text-[10px] text-[#999] mt-1">
                    {t('patients.dialog.initialsHelp')}
                  </p>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#555] mb-1">
                    {t('patients.dialog.dob')}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDob}
                    onChange={(e) => setFormDob(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('patients.dialog.site')}
                </label>
                <select
                  value={formSite}
                  onChange={(e) => setFormSite(e.target.value as Site)}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                >
                  <option value="france">
                    {t('admin.sites.france')}
                  </option>
                  <option value="england">
                    {t('admin.sites.england')}
                  </option>
                </select>
              </div>

              {message?.type === 'error' && (
                <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {message.text}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDialog(false);
                    setMessage(null);
                  }}
                  className="flex-1 py-2 text-sm rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
                >
                  {t('patients.dialog.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                             hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
                >
                  {isPending
                    ? t('patients.dialog.creating')
                    : t('patients.dialog.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
