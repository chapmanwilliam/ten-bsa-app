'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface SaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (patientId: string, date: string) => Promise<void>;
  defaultPatientId?: string;
  missingFields?: string[];
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function SaveDialog({ open, onClose, onSave, defaultPatientId, missingFields = [] }: SaveDialogProps) {
  const t = useTranslations('local');
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(todayISO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (defaultPatientId) setPatientId(defaultPatientId);
      setDate(todayISO());
      setError('');
      setSaving(false);
      // Focus patient ID input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultPatientId]);

  if (!open) return null;

  const handleSave = async () => {
    if (!patientId.trim()) {
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(patientId.trim(), date);
      onClose();
    } catch {
      setError(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[90vw] max-w-[340px] p-5">
        <h2 className="text-sm font-bold text-[#1a1a1a] mb-4">{t('saveTitle')}</h2>

        {/* Patient ID */}
        <label className="block text-[11px] font-semibold text-[#555] mb-1">
          {t('patientId')}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder={t('patientIdPlaceholder')}
          className="w-full px-3 py-2 mb-3 rounded-lg border border-[#ccc] text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/40 focus:border-[#c95a8a]"
        />

        {/* Date */}
        <label className="block text-[11px] font-semibold text-[#555] mb-1">
          {t('date')}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 mb-4 rounded-lg border border-[#ccc] text-sm
                     focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/40 focus:border-[#c95a8a]"
        />

        {/* Missing data warnings */}
        {missingFields.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {missingFields.map((msg) => (
              <div key={msg} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                <span className="text-base leading-none">&#9888;</span>
                <span>{msg}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 mb-3">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-[#ccc] text-xs font-semibold text-[#555]
                       hover:bg-[#f0f0f0] active:bg-[#e0e0e0] transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !patientId.trim()}
            className="px-4 py-2 rounded-lg bg-[#c95a8a] text-white text-xs font-semibold
                       hover:bg-[#b44d7a] active:bg-[#a0426c] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('saving') : t('saveFile')}
          </button>
        </div>
      </div>
    </div>
  );
}
