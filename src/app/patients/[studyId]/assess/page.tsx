'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { View } from '@/engine';
import { useDrawingEngine } from '@/hooks/useDrawingEngine';
import { BodyCanvas } from '@/components/canvas/BodyCanvas';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { BrushControls } from '@/components/canvas/BrushControls';
import { ViewToggle } from '@/components/canvas/ViewToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PhotoEditor } from '@/components/photos/PhotoEditor';
import { getPatient, getPatientAssessmentCount, getPreviousAssessmentMaps, submitAssessment } from '../../actions';
import { getCurrentClinician } from '@/app/admin/actions';
import { getStudySites } from '@/lib/sites';
import { SiteSelect } from '@/components/ui/SiteSelect';
import { SiteLabel } from '@/components/ui/SiteLabel';
import { findNearestSite } from '@/lib/geo';
import { extractPhotoMetadata, type PhotoMetadata } from '@/lib/exif';
import type { Database, StudySite } from '@/lib/supabase/types';

type Patient = Database['public']['Tables']['patients']['Row'];

interface PhotoEntry {
  id: string;
  dataUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  caption: string;
  metadata: PhotoMetadata | null;
}

export default function AssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const studyId = params.studyId as string;
  const t = useTranslations();
  const locale = useLocale();

  const {
    engine,
    calculation,
    registerCanvasRefs,
    setTool,
    setBrushRadius,
    undo,
    clearAll,
    clearView,
    currentTool,
    brushRadius,
  } = useDrawingEngine();

  const [activeView, setActiveView] = useState<View>('anterior');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [albuminLevel, setAlbuminLevel] = useState('');
  const [crpLevel, setCrpLevel] = useState('');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // For generating composite previews in confirmation dialog
  const [confirmPreviews, setConfirmPreviews] = useState<{
    anterior: string | null;
    posterior: string | null;
  }>({ anterior: null, posterior: null });

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);

  // SCORTEN — only shown for first assessment
  const [isFirstAssessment, setIsFirstAssessment] = useState(false);
  const [scortenHr, setScorenHr] = useState<boolean | null>(null);
  const [scortenMalignancy, setScorenMalignancy] = useState<boolean | null>(null);
  const [scortenUrea, setScorenUrea] = useState<boolean | null>(null);
  const [scortenBicarb, setScorenBicarb] = useState<boolean | null>(null);
  const [scortenGlucose, setScorenGlucose] = useState<boolean | null>(null);

  // Site selection + geolocation
  const [sites, setSites] = useState<StudySite[]>([]);
  const [assessmentSite, setAssessmentSite] = useState('');
  const [geoHint, setGeoHint] = useState<string | null>(null);

  // Load previous body maps
  const [showLoadPrompt, setShowLoadPrompt] = useState(false);
  const [previousMaps, setPreviousMaps] = useState<{
    date: string;
    anteriorTbsa: string | null;
    anteriorDbsa: string | null;
    posteriorTbsa: string | null;
    posteriorDbsa: string | null;
  } | null>(null);
  const [loadingMaps, setLoadingMaps] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const [p, siteList, clinician] = await Promise.all([
        getPatient(studyId),
        getStudySites(),
        getCurrentClinician(),
      ]);
      setSites(siteList);
      setPatient(p);
      setLoading(false);
      if (!p) {
        router.push('/');
        return;
      }
      // Check if this is the first assessment — SCORTEN required
      const count = await getPatientAssessmentCount(p.id);
      setIsFirstAssessment(count === 0);

      // If there are previous assessments, fetch the most recent maps + site
      if (count > 0) {
        const maps = await getPreviousAssessmentMaps(p.id);
        if (maps) {
          setPreviousMaps(maps);
          setShowLoadPrompt(true);
          // Default site: last assessment's site
          if (maps.site) {
            setAssessmentSite(maps.site);
          } else {
            setAssessmentSite(clinician?.site || p.site);
          }
        } else {
          setAssessmentSite(clinician?.site || p.site);
        }
      } else {
        // First assessment: use clinician's site
        setAssessmentSite(clinician?.site || p.site);
      }
    }
    load();
  }, [studyId, router]);

  // Geolocation hint — one-shot, non-blocking
  useEffect(() => {
    if (sites.length === 0 || !assessmentSite) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestSite(
          position.coords.latitude,
          position.coords.longitude,
          sites,
        );
        // Show hint if nearest site is within 100km and differs from current selection
        if (nearest && nearest.distanceKm < 100 && nearest.site.key !== assessmentSite) {
          setGeoHint(nearest.site.key);
        }
      },
      () => {
        // Permission denied or error — silently ignore
      },
      { timeout: 10000, maximumAge: 300000 },
    );
  }, [sites, assessmentSite]);

  async function handleLoadPreviousMaps() {
    if (!engine || !previousMaps) return;
    setLoadingMaps(true);
    try {
      const loads: Promise<void>[] = [];
      if (previousMaps.anteriorTbsa) {
        loads.push(engine.loadLayerImage('anterior', 'tbsa', previousMaps.anteriorTbsa));
      }
      if (previousMaps.anteriorDbsa) {
        loads.push(engine.loadLayerImage('anterior', 'dbsa', previousMaps.anteriorDbsa));
      }
      if (previousMaps.posteriorTbsa) {
        loads.push(engine.loadLayerImage('posterior', 'tbsa', previousMaps.posteriorTbsa));
      }
      if (previousMaps.posteriorDbsa) {
        loads.push(engine.loadLayerImage('posterior', 'dbsa', previousMaps.posteriorDbsa));
      }
      await Promise.all(loads);
    } finally {
      setLoadingMaps(false);
      setShowLoadPrompt(false);
    }
  }

  function handleAddPhoto() {
    photoInputRef.current?.click();
  }

  // Resize an image to max 1600px on longest side, return JPEG data URL
  function resizeImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          let w = img.width;
          let h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) {
              h = Math.round((h * MAX) / w);
              w = MAX;
            } else {
              w = Math.round((w * MAX) / h);
              h = MAX;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          // Compress to JPEG at 80% quality
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      // Extract EXIF from original file before resize (resize strips EXIF)
      const [dataUrl, metadata] = await Promise.all([
        resizeImage(file),
        extractPhotoMetadata(file),
      ]);
      setPhotos((prev) => [
        ...prev,
        {
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          fileName: file.name,
          fileSize: dataUrl.length,
          mimeType: 'image/jpeg',
          caption: '',
          metadata,
        },
      ]);
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePhotoCaption(id: string, caption: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, caption } : p)),
    );
  }

  function handleSubmitClick() {
    // Validate SCORTEN is complete for first assessment
    if (
      isFirstAssessment &&
      (scortenHr === null ||
        scortenMalignancy === null ||
        scortenUrea === null ||
        scortenBicarb === null ||
        scortenGlucose === null)
    ) {
      setMessage({
        type: 'error',
        text: locale === 'fr'
          ? 'Veuillez compléter tous les critères SCORTEN avant de soumettre.'
          : 'Please complete all SCORTEN criteria before submitting.',
      });
      return;
    }

    // Generate composite previews for the confirmation dialog
    if (engine) {
      setConfirmPreviews({
        anterior: engine.exportComposite('anterior'),
        posterior: engine.exportComposite('posterior'),
      });
    }
    setShowConfirm(true);
  }

  function handleConfirmSubmit() {
    if (!patient || !engine) return;
    setMessage(null);

    startTransition(async () => {
      try {
      // Export canvas images
      const anteriorTbsa = engine.exportLayerAsPNG('draw-tbsa-anterior');
      const anteriorDbsa = engine.exportLayerAsPNG('draw-dbsa-anterior');
      const posteriorTbsa = engine.exportLayerAsPNG('draw-tbsa-posterior');
      const posteriorDbsa = engine.exportLayerAsPNG('draw-dbsa-posterior');
      const compositeAnterior = engine.exportComposite('anterior');
      const compositePosterior = engine.exportComposite('posterior');

      if (
        !anteriorTbsa ||
        !anteriorDbsa ||
        !posteriorTbsa ||
        !posteriorDbsa ||
        !compositeAnterior ||
        !compositePosterior
      ) {
        setMessage({ type: 'error', text: 'Failed to export canvas images.' });
        setShowConfirm(false);
        return;
      }

      // Get calculation
      const calc = engine.getCalculation();

      // Build region maps: { regionName: contribution }
      const tbsaRegions: Record<string, number> = {};
      for (const r of calc.tbsaRegions) {
        tbsaRegions[r.name] = r.contribution;
      }
      const dbsaRegions: Record<string, number> = {};
      for (const r of calc.dbsaRegions) {
        dbsaRegions[r.name] = r.contribution;
      }

      // Parse albumin + CRP
      const parsedAlbumin = albuminLevel.trim()
        ? parseFloat(albuminLevel.trim())
        : null;
      const parsedCrp = crpLevel.trim()
        ? parseFloat(crpLevel.trim())
        : null;

      // Build SCORTEN payload for first assessment
      const scortenPayload =
        isFirstAssessment &&
        scortenScore !== null &&
        scortenHr !== null &&
        scortenMalignancy !== null &&
        scortenUrea !== null &&
        scortenBicarb !== null &&
        scortenGlucose !== null
          ? {
              score: scortenScore,
              ageGte40: scortenAgeGte40,
              hrGte120: scortenHr,
              malignancy: scortenMalignancy,
              bsaGte10: scortenBsaGte10,
              ureaGt10: scortenUrea,
              bicarbLt20: scortenBicarb,
              glucoseGt14: scortenGlucose,
            }
          : null;

      const result = await submitAssessment({
        patientId: patient.id,
        site: assessmentSite,
        tbsaPercent: Math.round(calc.tbsa * 10) / 10,
        dbsaPercent: Math.round(calc.dbsa * 10) / 10,
        tbsaRegions,
        dbsaRegions,
        notes,
        notesLanguage: locale,
        albuminLevel:
          parsedAlbumin !== null && !isNaN(parsedAlbumin)
            ? parsedAlbumin
            : null,
        crpLevel:
          parsedCrp !== null && !isNaN(parsedCrp)
            ? parsedCrp
            : null,
        photos: photos.map((p) => ({
          dataUrl: p.dataUrl,
          fileName: p.fileName,
          fileSize: p.fileSize,
          mimeType: p.mimeType,
          caption: p.caption,
          metadata: p.metadata as Record<string, unknown> | null,
        })),
        canvasImages: {
          anteriorTbsa,
          anteriorDbsa,
          posteriorTbsa,
          posteriorDbsa,
          compositeAnterior,
          compositePosterior,
        },
        scorten: scortenPayload,
      });

      setShowConfirm(false);

      if (result.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: t('assessment.submitSuccess') });
        // Navigate to patient detail after short delay
        setTimeout(() => {
          router.push(`/patients/${studyId}`);
        }, 1500);
      }
      } catch (err) {
        console.error('Submit error:', err);
        setShowConfirm(false);
        setMessage({
          type: 'error',
          text: `Error: ${err instanceof Error ? err.message : 'Unknown error. Please try again.'}`,
        });
      }
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

  const parsedAlbuminForDisplay = albuminLevel.trim()
    ? parseFloat(albuminLevel.trim())
    : null;
  const parsedCrpForDisplay = crpLevel.trim()
    ? parseFloat(crpLevel.trim())
    : null;

  // --- SCORTEN auto-computed values ---
  const scortenAgeGte40 = (() => {
    if (!patient.date_of_birth) return false;
    const dob = new Date(patient.date_of_birth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age >= 40;
  })();

  const scortenBsaGte10 = calculation.tbsa >= 10;

  // Compute SCORTEN score when all 5 clinician inputs are answered
  const scortenAllAnswered =
    isFirstAssessment &&
    scortenHr !== null &&
    scortenMalignancy !== null &&
    scortenUrea !== null &&
    scortenBicarb !== null &&
    scortenGlucose !== null;

  const scortenScore = scortenAllAnswered
    ? [
        scortenAgeGte40,
        scortenHr,
        scortenMalignancy,
        scortenBsaGte10,
        scortenUrea,
        scortenBicarb,
        scortenGlucose,
      ].filter(Boolean).length
    : null;

  const scortenMortalityMap: Record<number, string> = {
    0: '3.2%',
    1: '3.2%',
    2: '12.1%',
    3: '35.3%',
    4: '58.3%',
    5: '90%',
    6: '90%',
    7: '90%',
  };

  const scortenMortality =
    scortenScore !== null ? scortenMortalityMap[scortenScore] : null;

  // Block submission if SCORTEN incomplete on first assessment
  const scortenIncomplete =
    isFirstAssessment &&
    (scortenHr === null ||
      scortenMalignancy === null ||
      scortenUrea === null ||
      scortenBicarb === null ||
      scortenGlucose === null);

  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Top bar — results + actions */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-3 py-2 bg-white border-b border-[#b0b0a8]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/patients/${studyId}`)}
            className="text-xs text-[#888] hover:text-[#333]"
          >
            {t('nav.backToPatient')}
          </button>
          <span className="text-xs text-[#aaa]">|</span>
          <span className="text-xs font-semibold text-[#555]">
            {patient.study_id} ({patient.initials})
          </span>
        </div>
        <div className="flex gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#c95a8a]">
              {t('tools.tbsa')}
            </span>
            <span className="font-mono text-[22px] font-medium text-[#c95a8a]">
              {calculation.tbsa.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#8395a7]">
              {t('tools.dbsa')}
            </span>
            <span className="font-mono text-[22px] font-medium text-[#8395a7]">
              {calculation.dbsa.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Tool bar */}
      <div className="sticky top-[41px] z-50 flex items-center justify-between px-3 py-1.5 bg-[#f8f8f5] border-b border-[#d0d0c8]">
        <div className="flex gap-1.5 items-center">
          <LanguageToggle />
          <button
            onClick={undo}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            &#x21A9; {t('actions.undo')}
          </button>
          <button
            onClick={() => clearView(activeView)}
            className="px-2.5 py-1.5 rounded-md border border-[#b0b0a8] bg-white text-[#555] text-[11px] font-semibold cursor-pointer active:bg-[#ddd]"
          >
            {t('actions.clear')}
          </button>
        </div>
        <button
          onClick={handleSubmitClick}
          disabled={isPending || scortenIncomplete}
          className="px-4 py-1.5 rounded-md bg-[#c95a8a] text-white text-[11px] font-semibold
                     hover:bg-[#b44d7a] active:bg-[#a0426c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? t('assessment.submitting') : t('actions.submit')}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mx-3 mt-2 px-4 py-2 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main drawing area */}
      <div className="relative py-2">
        {/* Side tools */}
        <div className="absolute left-2 top-12 z-20">
          <CanvasToolbar currentTool={currentTool} onToolChange={setTool} />
        </div>

        {/* Centred column for toggle + canvas */}
        <div className="flex flex-col items-center pl-[60px] sm:pl-0">
          {/* View toggle + Brush controls */}
          <div className="w-[68vw] max-w-[320px] z-20 mb-1.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveView('anterior')}
                className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer border rounded-md shadow-sm transition-colors ${
                  activeView === 'anterior'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#555] border-[#b0b0a8]'
                }`}
              >
                {t('views.front')}
              </button>
              <BrushControls
                brushRadius={brushRadius}
                currentTool={currentTool}
                onBrushChange={setBrushRadius}
                compact
              />
              <button
                onClick={() => setActiveView('posterior')}
                className={`px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer border rounded-md shadow-sm transition-colors ${
                  activeView === 'posterior'
                    ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]'
                    : 'bg-white text-[#555] border-[#b0b0a8]'
                }`}
              >
                {t('views.back')}
              </button>
            </div>
          </div>

          {/* Canvas — anterior */}
          <div
            className={`w-[68vw] max-w-[320px] pb-2 ${
              activeView !== 'anterior' ? 'hidden' : ''
            }`}
          >
            <BodyCanvas
              view="anterior"
              engine={engine}
              onRegister={registerCanvasRefs}
            />
          </div>

          {/* Canvas — posterior */}
          <div
            className={`w-[68vw] max-w-[320px] pb-2 ${
              activeView !== 'posterior' ? 'hidden' : ''
            }`}
          >
            <BodyCanvas
              view="posterior"
              engine={engine}
              onRegister={registerCanvasRefs}
            />
          </div>
        </div>
      </div>


      {/* Site + Albumin + Notes + Photos section */}
      <div className="px-3 py-2 bg-white border-t border-[#d0d0c8] space-y-2">
        {/* Assessment site */}
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#555] whitespace-nowrap">
              {t('assessment.site')}
            </label>
            <SiteSelect
              sites={sites}
              value={assessmentSite}
              onChange={(val) => {
                setAssessmentSite(val);
                setGeoHint(null);
              }}
              className="py-1 text-xs"
            />
          </div>
          {geoHint && (
            <div className="mt-1 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-blue-700">
                {t('assessment.geoHint', { site: '' })}
                <SiteLabel sites={sites} siteKey={geoHint} className="font-semibold" />.
              </span>
              <button
                type="button"
                onClick={() => {
                  setAssessmentSite(geoHint);
                  setGeoHint(null);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                {t('assessment.geoSwitch')}
              </button>
            </div>
          )}
        </div>

        {/* Albumin level */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#555] whitespace-nowrap">
            {t('assessment.albumin')}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={albuminLevel}
              onChange={(e) => setAlbuminLevel(e.target.value)}
              placeholder={t('assessment.albuminPlaceholder')}
              className="w-20 px-2 py-1.5 text-xs rounded-lg border border-[#d0d0c8]
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
            />
            <span className="text-xs text-[#999]">{t('assessment.albuminUnit')}</span>
          </div>
        </div>

        {/* CRP level */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#555] whitespace-nowrap">
            {t('assessment.crp')}
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              min="0"
              max="1000"
              value={crpLevel}
              onChange={(e) => setCrpLevel(e.target.value)}
              placeholder={t('assessment.crpPlaceholder')}
              className="w-20 px-2 py-1.5 text-xs rounded-lg border border-[#d0d0c8]
                         focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]"
            />
            <span className="text-xs text-[#999]">{t('assessment.crpUnit')}</span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
            maxLength={4000}
            placeholder={t('assessment.notesPlaceholder')}
            rows={2}
            className={`w-full px-3 py-2 text-xs rounded-lg border resize-none
                       focus:outline-none focus:ring-2 focus:ring-[#c95a8a]/30 focus:border-[#c95a8a]
                       ${notes.length >= 4000 ? 'border-red-400' : notes.length >= 3600 ? 'border-amber-400' : 'border-[#d0d0c8]'}`}
          />
          <div className={`text-right text-[10px] mt-0.5 ${
            notes.length >= 4000 ? 'text-red-500 font-semibold' : notes.length >= 3600 ? 'text-amber-500' : 'text-[#aaa]'
          }`}>
            {notes.length.toLocaleString()} / 4,000
          </div>
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[#555]">
              {t('assessment.photos')}
            </label>
            <button
              type="button"
              onClick={handleAddPhoto}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-[#d0d0c8]
                         hover:bg-[#f0f0ea] transition-colors"
            >
              + {t('assessment.addPhoto')}
            </button>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelected}
            className="hidden"
          />
          {photos.length === 0 ? (
            <p className="text-[10px] text-[#999]">{t('assessment.photosHelp')}</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative flex-shrink-0 w-20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.dataUrl}
                    alt={photo.fileName}
                    onClick={() => setEditingPhotoId(photo.id)}
                    className="w-20 h-20 object-cover rounded-lg border border-[#d0d0c8] cursor-pointer"
                  />
                  <p className="text-[8px] text-center text-[#999] mt-0.5">{t('assessment.editPhoto')}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                    className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-red-500 text-white
                               text-xs flex items-center justify-center shadow-sm hover:bg-red-600 active:bg-red-700"
                  >
                    ×
                  </button>
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                    placeholder={t('assessment.photoCaption')}
                    className="w-full mt-1 px-1 py-0.5 text-[9px] rounded border border-[#d0d0c8]
                               focus:outline-none focus:border-[#c95a8a]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SCORTEN section — first assessment only */}
      {isFirstAssessment && (
        <div className="px-3 py-3 bg-white border-t border-[#d0d0c8]">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-bold text-[#1a1a1a]">
              {t('assessment.scortenTitle')}
            </h3>
            <span className="text-[10px] text-[#c95a8a] font-semibold">
              {t('assessment.scortenRequired')}
            </span>
          </div>

          <div className="space-y-2">
            {/* 1. Age ≥ 40 — auto */}
            <div className="flex items-center justify-between bg-[#f8f8f5] rounded-lg px-3 py-2">
              <div>
                <span className="text-xs text-[#333]">{t('assessment.scortenAge')}</span>
                <span className="block text-[10px] text-[#999]">{t('assessment.scortenAgeAuto')}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                scortenAgeGte40
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {scortenAgeGte40 ? t('assessment.scortenYes') : t('assessment.scortenNo')}
              </span>
            </div>

            {/* 2. Heart rate ≥ 120 */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              scortenHr === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-[#f8f8f5]'
            }`}>
              <span className="text-xs text-[#333]">{t('assessment.scortenHr')}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setScorenHr(true)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenHr === true
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setScorenHr(false)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenHr === false
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenNo')}
                </button>
              </div>
            </div>

            {/* 3. Cancer or haematologic malignancy */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              scortenMalignancy === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-[#f8f8f5]'
            }`}>
              <span className="text-xs text-[#333]">{t('assessment.scortenMalignancy')}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setScorenMalignancy(true)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenMalignancy === true
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setScorenMalignancy(false)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenMalignancy === false
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenNo')}
                </button>
              </div>
            </div>

            {/* 4. BSA involved ≥ 10% — auto */}
            <div className="flex items-center justify-between bg-[#f8f8f5] rounded-lg px-3 py-2">
              <div>
                <span className="text-xs text-[#333]">{t('assessment.scortenBsa')}</span>
                <span className="block text-[10px] text-[#999]">{t('assessment.scortenBsaAuto')}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                scortenBsaGte10
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {scortenBsaGte10 ? t('assessment.scortenYes') : t('assessment.scortenNo')}
              </span>
            </div>

            {/* 5. Serum urea > 10 mmol/L */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              scortenUrea === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-[#f8f8f5]'
            }`}>
              <div>
                <span className="text-xs text-[#333]">{t('assessment.scortenUrea')}</span>
                <span className="block text-[10px] text-[#999]">{t('assessment.scortenUreaAlt')}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setScorenUrea(true)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenUrea === true
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setScorenUrea(false)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenUrea === false
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenNo')}
                </button>
              </div>
            </div>

            {/* 6. Serum bicarbonate < 20 mmol/L */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              scortenBicarb === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-[#f8f8f5]'
            }`}>
              <div>
                <span className="text-xs text-[#333]">{t('assessment.scortenBicarb')}</span>
                <span className="block text-[10px] text-[#999]">{t('assessment.scortenBicarbAlt')}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setScorenBicarb(true)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenBicarb === true
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setScorenBicarb(false)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenBicarb === false
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenNo')}
                </button>
              </div>
            </div>

            {/* 7. Serum glucose > 14 mmol/L */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${
              scortenGlucose === null ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-[#f8f8f5]'
            }`}>
              <div>
                <span className="text-xs text-[#333]">{t('assessment.scortenGlucose')}</span>
                <span className="block text-[10px] text-[#999]">{t('assessment.scortenGlucoseAlt')}</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setScorenGlucose(true)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenGlucose === true
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setScorenGlucose(false)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                    scortenGlucose === false
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'border-[#d0d0c8] text-[#888] hover:bg-[#f0f0ea]'
                  }`}
                >
                  {t('assessment.scortenNo')}
                </button>
              </div>
            </div>

            {/* Score display or incomplete warning */}
            {scortenScore !== null ? (
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white">
                    {t('assessment.scortenScore')}: {scortenScore}/7
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#aaa]">
                    {t('assessment.scortenMortality')}
                  </span>
                  <span className={`block text-sm font-bold ${
                    scortenScore >= 5 ? 'text-red-400' :
                    scortenScore >= 3 ? 'text-orange-400' :
                    scortenScore >= 2 ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {scortenMortality}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-amber-600 text-sm">⚠</span>
                <span className="text-[11px] text-amber-700 font-medium">
                  {locale === 'fr'
                    ? 'Complétez tous les critères ci-dessus pour calculer le SCORTEN. La soumission est bloquée.'
                    : 'Complete all criteria above to calculate SCORTEN. Submission is blocked until complete.'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Photo Editor Overlay */}
      {editingPhotoId && (() => {
        const photo = photos.find((p) => p.id === editingPhotoId);
        if (!photo) return null;
        return (
          <PhotoEditor
            dataUrl={photo.dataUrl}
            onSave={(editedUrl) => {
              setPhotos((prev) =>
                prev.map((p) =>
                  p.id === editingPhotoId
                    ? { ...p, dataUrl: editedUrl, fileSize: editedUrl.length }
                    : p,
                ),
              );
              setEditingPhotoId(null);
            }}
            onCancel={() => setEditingPhotoId(null)}
          />
        );
      })()}

      {/* Enhanced Confirm Submit Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-[#d0d0c8] shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-3">
              {t('assessment.confirmSubmit')}
            </h3>

            {/* Summary section */}
            <div className="space-y-3 mb-4">
              {/* TBSA / DBSA */}
              <div className="bg-[#f8f8f5] rounded-lg p-3">
                <div className="flex items-baseline gap-4 justify-center">
                  <div className="text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#c95a8a] block">
                      {t('tools.tbsa')}
                    </span>
                    <span className="font-mono text-2xl font-medium text-[#c95a8a]">
                      {calculation.tbsa.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8395a7] block">
                      {t('tools.dbsa')}
                    </span>
                    <span className="font-mono text-2xl font-medium text-[#8395a7]">
                      {calculation.dbsa.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Site */}
              {assessmentSite && (
                <div className="flex items-center gap-2 text-xs bg-[#f8f8f5] rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#555]">
                    {t('assessment.confirmSite')}:
                  </span>
                  <SiteLabel sites={sites} siteKey={assessmentSite} />
                </div>
              )}

              {/* Body map previews */}
              {(confirmPreviews.anterior || confirmPreviews.posterior) && (
                <div className="flex gap-2 justify-center bg-[#f8f8f5] rounded-lg p-2">
                  {confirmPreviews.anterior && (
                    <div className="text-center">
                      <p className="text-[9px] font-semibold text-[#999] uppercase tracking-wide mb-0.5">
                        {t('views.front')}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={confirmPreviews.anterior}
                        alt="Anterior preview"
                        className="h-28 w-auto rounded border border-[#e0e0d8]"
                      />
                    </div>
                  )}
                  {confirmPreviews.posterior && (
                    <div className="text-center">
                      <p className="text-[9px] font-semibold text-[#999] uppercase tracking-wide mb-0.5">
                        {t('views.back')}
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={confirmPreviews.posterior}
                        alt="Posterior preview"
                        className="h-28 w-auto rounded border border-[#e0e0d8]"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Albumin */}
              {parsedAlbuminForDisplay !== null && !isNaN(parsedAlbuminForDisplay) && (
                <div className="flex items-center gap-2 text-xs bg-[#f8f8f5] rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#555]">
                    {t('assessment.confirmAlbumin')}:
                  </span>
                  <span className="font-mono font-medium">
                    {parsedAlbuminForDisplay} {t('assessment.albuminUnit')}
                  </span>
                </div>
              )}

              {/* CRP */}
              {parsedCrpForDisplay !== null && !isNaN(parsedCrpForDisplay) && (
                <div className="flex items-center gap-2 text-xs bg-[#f8f8f5] rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#555]">
                    {t('assessment.confirmCrp')}:
                  </span>
                  <span className="font-mono font-medium">
                    {parsedCrpForDisplay} {t('assessment.crpUnit')}
                  </span>
                </div>
              )}

              {/* Notes */}
              {notes.trim() && (
                <div className="text-xs bg-[#f8f8f5] rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#555] block mb-0.5">
                    {t('assessment.confirmNotes')}:
                  </span>
                  <span className="text-[#666]">{notes}</span>
                </div>
              )}

              {/* Photos count */}
              {photos.length > 0 && (
                <div className="text-xs bg-[#f8f8f5] rounded-lg px-3 py-2">
                  <span className="font-semibold text-[#555]">
                    {t('assessment.confirmPhotos')}:
                  </span>{' '}
                  <span className="text-[#666]">
                    {t('assessment.confirmPhotoCount', { count: photos.length })}
                  </span>
                  <div className="flex gap-1.5 mt-1.5">
                    {photos.map((photo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={photo.id}
                        src={photo.dataUrl}
                        alt={photo.fileName}
                        className="w-10 h-10 object-cover rounded border border-[#e0e0d8]"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SCORTEN in confirmation */}
              {isFirstAssessment && scortenScore !== null && (
                <div className="bg-[#1a1a1a] rounded-lg px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">
                      {t('assessment.confirmScorten')}: {scortenScore}/7
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#aaa]">
                      {t('assessment.scortenMortality')}
                    </span>
                    <span className={`block text-sm font-bold ${
                      scortenScore >= 5 ? 'text-red-400' :
                      scortenScore >= 3 ? 'text-orange-400' :
                      scortenScore >= 2 ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {scortenMortality}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Missing data reminders */}
            {(photos.length === 0 || !notes.trim() || parsedAlbuminForDisplay === null || isNaN(parsedAlbuminForDisplay) || parsedCrpForDisplay === null || isNaN(parsedCrpForDisplay)) && (
              <div className="space-y-1.5 mb-3">
                {photos.length === 0 && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                    <span className="text-base leading-none">&#9888;</span>
                    <span>{t('assessment.missingPhotos')}</span>
                  </div>
                )}
                {!notes.trim() && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                    <span className="text-base leading-none">&#9888;</span>
                    <span>{t('assessment.missingNotes')}</span>
                  </div>
                )}
                {(parsedAlbuminForDisplay === null || isNaN(parsedAlbuminForDisplay)) && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                    <span className="text-base leading-none">&#9888;</span>
                    <span>{t('assessment.missingAlbumin')}</span>
                  </div>
                )}
                {(parsedCrpForDisplay === null || isNaN(parsedCrpForDisplay)) && (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                    <span className="text-base leading-none">&#9888;</span>
                    <span>{t('assessment.missingCrp')}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#999] mb-3">
              {t('assessment.confirmMessage')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="flex-1 py-2 text-sm rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
              >
                {t('assessment.cancel')}
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={isPending}
                className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                           hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? t('assessment.submitting')
                  : t('assessment.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load previous body maps prompt */}
      {showLoadPrompt && previousMaps && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <h3 className="text-sm font-bold text-[#1a1a1a] mb-2">
              {t('assessment.loadPreviousTitle')}
            </h3>
            <p className="text-xs text-[#666] mb-4">
              {t('assessment.loadPreviousMessage', {
                date: new Date(previousMaps.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB'),
              })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLoadPrompt(false)}
                disabled={loadingMaps}
                className="flex-1 py-2 text-sm rounded-lg border border-[#d0d0c8] hover:bg-[#f0f0ea] transition-colors"
              >
                {t('assessment.loadPreviousNo')}
              </button>
              <button
                onClick={handleLoadPreviousMaps}
                disabled={loadingMaps}
                className="flex-1 py-2 text-sm font-semibold rounded-lg bg-[#c95a8a] text-white
                           hover:bg-[#b44d7a] disabled:opacity-50 transition-colors"
              >
                {loadingMaps
                  ? t('assessment.loadPreviousLoading')
                  : t('assessment.loadPreviousYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
