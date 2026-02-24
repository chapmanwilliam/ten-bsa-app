'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ChangePasswordDialog } from '@/components/ui/ChangePasswordDialog';
import { createClient } from '@/lib/supabase/client';
import { getCurrentClinician, listClinicians } from './actions';
import { AdminTabs, type AdminTab } from './components/AdminTabs';
import { PatientOverview } from './components/PatientOverview';
import { ClinicianManagement } from './components/ClinicianManagement';
import { ExportPanel } from './components/ExportPanel';
import { AuditLogViewer } from './components/AuditLogViewer';
import type { Database } from '@/lib/supabase/types';

type Clinician = Database['public']['Tables']['clinicians']['Row'];

export default function AdminPage() {
  const t = useTranslations();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<Clinician | null>(null);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [user, list] = await Promise.all([
      getCurrentClinician(),
      listClinicians(),
    ]);
    setCurrentUser(user);
    setClinicians(list);

    // Redirect non-admin users
    if (user && !['admin', 'pi'].includes(user.role)) {
      router.push('/');
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (!currentUser) {
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
          <span className="text-xs text-[#888]">— {t('adminDashboard.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
          >
            {t('nav.patients')}
          </button>
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

      {/* Tabs */}
      <div className="bg-white">
        <div className="max-w-4xl mx-auto">
          <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-4xl mx-auto p-4">
        {activeTab === 'overview' && <PatientOverview />}
        {activeTab === 'clinicians' && (
          <ClinicianManagement
            currentUser={currentUser}
            initialClinicians={clinicians}
            onRefresh={loadData}
          />
        )}
        {activeTab === 'export' && <ExportPanel />}
        {activeTab === 'auditLog' && <AuditLogViewer />}
      </div>

      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
      />
    </div>
  );
}
