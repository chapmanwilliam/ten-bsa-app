'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  listClinicians,
  createClinician,
  toggleClinicianActive,
  getClinicianMfaStatuses,
  resetClinicianMfa,
  resetClinicianPassword,
  type ClinicianMfaStatus,
} from '../actions';
import type { Role, Site, Database } from '@/lib/supabase/types';

type Clinician = Database['public']['Tables']['clinicians']['Row'];

interface ClinicianManagementProps {
  currentUser: Clinician;
  initialClinicians: Clinician[];
  onRefresh: () => void;
}

export function ClinicianManagement({
  currentUser,
  initialClinicians,
  onRefresh,
}: ClinicianManagementProps) {
  const t = useTranslations();
  const [clinicians, setClinicians] = useState<Clinician[]>(initialClinicians);
  const [mfaStatuses, setMfaStatuses] = useState<Record<string, boolean>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<Role>('clinician');
  const [formSite, setFormSite] = useState<Site>('england');

  // Reset password dialog state
  const [resetPwClinicianId, setResetPwClinicianId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');

  // Load MFA statuses on mount and when clinicians change
  useEffect(() => {
    loadMfaStatuses(clinicians);
  }, []);

  async function loadMfaStatuses(list: Clinician[]) {
    if (list.length === 0) return;
    const statuses = await getClinicianMfaStatuses(list.map((c) => c.id));
    const map: Record<string, boolean> = {};
    statuses.forEach((s) => {
      map[s.clinicianId] = s.hasMfa;
    });
    setMfaStatuses(map);
  }

  async function reload() {
    const list = await listClinicians();
    setClinicians(list);
    await loadMfaStatuses(list);
    onRefresh();
  }

  function handleResetMfa(clinicianId: string) {
    if (!confirm(t('mfa.resetConfirm'))) return;

    startTransition(async () => {
      const result = await resetClinicianMfa(clinicianId);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('mfa.resetSuccess') });
        await reload();
      }
    });
  }

  function handleResetPassword() {
    if (!resetPwClinicianId || !resetPwValue) return;

    startTransition(async () => {
      const result = await resetClinicianPassword(resetPwClinicianId, resetPwValue);
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('admin.resetPasswordSuccess') });
      }
      setResetPwClinicianId(null);
      setResetPwValue('');
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createClinician({
        email: formEmail,
        fullName: formName,
        password: formPassword,
        role: formRole,
        site: formSite,
      });

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('admin.dialog.success') });
        setShowDialog(false);
        setFormName('');
        setFormEmail('');
        setFormPassword('');
        setFormRole('clinician');
        setFormSite('england');
        await reload();
      }
    });
  }

  function handleToggleActive(id: string, currentlyActive: boolean) {
    startTransition(async () => {
      await toggleClinicianActive(id, !currentlyActive);
      await reload();
    });
  }

  return (
    <div>
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

      {/* Add clinician button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-[#555]">
          {t('admin.title')}
        </h3>
        <button
          onClick={() => setShowDialog(true)}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#c95a8a] text-white
                     hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors"
        >
          + {t('admin.addClinician')}
        </button>
      </div>

      {/* Clinicians table */}
      {clinicians.length === 0 ? (
        <div className="text-center py-12 text-[#888] text-sm">
          {t('admin.noClinicians')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#d0d0c8] overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#f8f8f5] border-b border-[#d0d0c8]">
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.name')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.email')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.role')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.site')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.status')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('mfa.mfaStatus')}
                </th>
                <th className="text-right px-3 py-2.5 font-semibold text-[#555] whitespace-nowrap">
                  {t('admin.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {clinicians.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#eee] last:border-0"
                >
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.full_name}</td>
                  <td className="px-3 py-2.5 text-[#666] whitespace-nowrap text-xs">{c.email}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-[#f0f0ea] text-[#555] whitespace-nowrap">
                      {t(`admin.roles.${c.role}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {t(`admin.sites.${c.site}`)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                        c.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {c.is_active ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                        mfaStatuses[c.id]
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {mfaStatuses[c.id]
                        ? t('mfa.enrolled')
                        : t('mfa.notEnrolled')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {c.id !== currentUser.id && (
                        <>
                          <button
                            onClick={() =>
                              handleToggleActive(c.id, c.is_active)
                            }
                            disabled={isPending}
                            className="text-xs text-[#888] hover:text-[#333] disabled:opacity-50"
                          >
                            {c.is_active
                              ? t('admin.deactivate')
                              : t('admin.activate')}
                          </button>
                          <button
                            onClick={() => {
                              setResetPwClinicianId(c.id);
                              setResetPwValue('');
                            }}
                            disabled={isPending}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {t('admin.resetPassword')}
                          </button>
                          {mfaStatuses[c.id] && (
                            <button
                              onClick={() => handleResetMfa(c.id)}
                              disabled={isPending}
                              className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-50"
                            >
                              {t('mfa.resetMfa')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Clinician Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-lg w-full max-w-md p-6">
            <h3 className="text-base font-semibold mb-4">
              {t('admin.dialog.title')}
            </h3>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('admin.name')}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t('admin.dialog.namePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('admin.email')}
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder={t('admin.dialog.emailPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('admin.dialog.tempPassword')}
                </label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                />
                <p className="text-[10px] text-[#999] mt-1">
                  {t('admin.dialog.tempPasswordHelp')}
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#555] mb-1">
                    {t('admin.role')}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                  >
                    <option value="clinician">{t('admin.roles.clinician')}</option>
                    <option value="admin">{t('admin.roles.admin')}</option>
                    <option value="pi">{t('admin.roles.pi')}</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#555] mb-1">
                    {t('admin.site')}
                  </label>
                  <select
                    value={formSite}
                    onChange={(e) => setFormSite(e.target.value as Site)}
                    className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                  >
                    <option value="england">{t('admin.sites.england')}</option>
                    <option value="france">{t('admin.sites.france')}</option>
                  </select>
                </div>
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
                  {t('admin.dialog.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                             hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
                >
                  {isPending
                    ? t('admin.dialog.creating')
                    : t('admin.dialog.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reset Password Dialog */}
      {resetPwClinicianId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-lg w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-4">
              {t('admin.resetPasswordTitle')}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#555] mb-1">
                  {t('admin.resetPasswordLabel')}
                </label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={resetPwValue}
                  onChange={(e) => setResetPwValue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#d0d0c8] text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
                />
                <p className="text-[10px] text-[#999] mt-1">
                  {t('admin.resetPasswordHelp')}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPwClinicianId(null);
                    setResetPwValue('');
                  }}
                  className="flex-1 py-2 text-sm rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
                >
                  {t('admin.dialog.cancel')}
                </button>
                <button
                  type="button"
                  disabled={isPending || resetPwValue.length < 8}
                  onClick={handleResetPassword}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                             hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
                >
                  {t('admin.resetPasswordConfirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
