'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AgreementPreferences } from '@prisma/client';
import { type WizardFormData, DEFAULT_FORM } from './WizardTypes';
import { Step1HouseRules } from './Step1HouseRules';
import { Step2Utilities } from './Step2Utilities';
import { Step3Financial } from './Step3Financial';
import { Step4Maintenance } from './Step4Maintenance';
import { Step5Ending } from './Step5Ending';
import { Step6Deposit } from './Step6Deposit';

interface RoomMeta {
  wifiIncluded: boolean;
  waterIncluded: boolean;
  electricIncluded: boolean;
}

interface WizardContainerProps {
  tenancyId: string;
  roomMeta: RoomMeta;
  existingPreferences: AgreementPreferences | null;
}

function buildInitialForm(tenancyId: string, prefs: AgreementPreferences | null): WizardFormData {
  if (!prefs) return { tenancyId, ...DEFAULT_FORM };

  return {
    tenancyId,
    petsPolicy: prefs.petsPolicy,
    petsMaxCount: prefs.petsMaxCount ?? null,
    petsDeposit: prefs.petsDeposit ? Number(prefs.petsDeposit) : null,
    smokingPolicy: prefs.smokingPolicy,
    overnightGuests: prefs.overnightGuests,
    overnightMaxNights: prefs.overnightMaxNights ?? null,
    quietHoursPolicy: prefs.quietHoursPolicy,
    quietHoursCustom: prefs.quietHoursCustom ?? '',
    additionalHouseRules: prefs.additionalHouseRules ?? '',
    utilityPaymentMethod: prefs.utilityPaymentMethod,
    utilityDisputeMethod: prefs.utilityDisputeMethod,
    internetProvider: prefs.internetProvider ?? '',
    internetAccountManager: prefs.internetAccountManager ?? 'LANDLORD',
    acServicing: prefs.acServicing,
    pestControl: prefs.pestControl,
    rentDueDay: prefs.rentDueDay,
    gracePeriodDays: prefs.gracePeriodDays,
    latePenaltyType: prefs.latePenaltyType,
    latePenaltyAmount: prefs.latePenaltyAmount ? Number(prefs.latePenaltyAmount) : null,
    acceptablePaymentMethods: (() => {
      try { return JSON.parse(prefs.acceptablePaymentMethods); } catch { return ['BANK_TRANSFER']; }
    })(),
    rentIncreaseTerms: prefs.rentIncreaseTerms,
    rentIncreasePercent: prefs.rentIncreasePercent ? Number(prefs.rentIncreasePercent) : null,
    minorRepairThreshold: Number(prefs.minorRepairThreshold),
    minorRepairResponsible: prefs.minorRepairResponsible,
    plumbingResponsible: prefs.plumbingResponsible,
    electricalResponsible: prefs.electricalResponsible,
    applianceResponsible: prefs.applianceResponsible,
    structuralResponsible: prefs.structuralResponsible,
    urgentResponseTime: prefs.urgentResponseTime,
    tenantNoticeMonths: prefs.tenantNoticeMonths,
    landlordNoticeMonths: prefs.landlordNoticeMonths,
    earlyTerminationPenalty: prefs.earlyTerminationPenalty,
    earlyTerminationMonths: prefs.earlyTerminationMonths ?? null,
    reinstatementLevel: prefs.reinstatementLevel,
    sublettingPolicy: prefs.sublettingPolicy,
    depositRefundDays: prefs.depositRefundDays,
    deductionCategories: (() => {
      try { return JSON.parse(prefs.deductionCategories); } catch { return ['DAMAGE', 'UNPAID_RENT']; }
    })(),
    disputeResolution: prefs.disputeResolution,
    utilityDepositHandling: prefs.utilityDepositHandling,
  };
}

const STEP_TITLES = [
  'House Rules & Occupancy',
  'Utilities & Services',
  'Financial Terms',
  'Maintenance & Repairs',
  'Ending the Tenancy',
  'Deposit Handling',
];

export function WizardContainer({ tenancyId, roomMeta, existingPreferences }: WizardContainerProps) {
  const router = useRouter();
  const [step, setStep] = useState(existingPreferences?.completedSteps ?? 0);
  const currentStep = step + 1; // 1-indexed for display

  const [form, setForm] = useState<WizardFormData>(() =>
    buildInitialForm(tenancyId, existingPreferences),
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const updateForm = useCallback((updates: Partial<WizardFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const buildPayload = useCallback(
    (isComplete: boolean) => {
      const { tenancyId: _tid, ...rest } = form;
      return {
        tenancyId,
        ...rest,
        acceptablePaymentMethods: JSON.stringify(form.acceptablePaymentMethods),
        deductionCategories: JSON.stringify(form.deductionCategories),
        completedSteps: Math.max(currentStep, existingPreferences?.completedSteps ?? 0),
        isComplete,
      };
    },
    [form, tenancyId, currentStep, existingPreferences],
  );

  const savePreferences = useCallback(
    async (isComplete: boolean) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch('/api/agreement-preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(isComplete)),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Failed to save preferences');
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload],
  );

  const handleNext = async () => {
    const ok = await savePreferences(false);
    if (ok) {
      setStep((s) => Math.min(s + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleComplete = async () => {
    const saved = await savePreferences(true);
    if (!saved) return;

    setGenerating(true);
    setError(null);

    const messages = [
      'Sending your policy decisions to the AI…',
      'Drafting agreement clauses…',
      'Analysing for red flags…',
    ];
    let msgIdx = 0;
    setLoadingMessage(messages[0]);
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 20000);

    try {
      const res = await fetch('/api/agreements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenancyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      router.push(`/dashboard/landlord/tenancies/${tenancyId}/agreement`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
      setGenerating(false);
    } finally {
      clearInterval(interval);
    }
  };

  // Full-screen generating overlay
  if (generating) {
    return (
      <div className="fixed inset-0 bg-[#1C2740] z-50 flex flex-col items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <div className="absolute inset-0 border-4 border-[rgba(196,154,60,0.2)] rounded-full" />
            <div className="absolute inset-0 border-4 border-[#C49A3C] rounded-full border-t-transparent animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Generating your agreement</h2>
          <p className="text-sm text-white/50 mb-4">This takes about 1 minute.</p>
          <p className="text-sm text-[#C49A3C] font-medium animate-pulse">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEP_TITLES.map((title, i) => {
            const stepNum = i + 1;
            const done = stepNum <= step;
            const current = stepNum === currentStep;
            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done && stepNum < currentStep
                      ? 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740]'
                      : current
                        ? 'border-2 border-[#C49A3C] text-[#C49A3C] bg-[#1C2740]'
                        : 'border border-white/10 text-white/40 bg-[#1C2740]'
                  }`}
                >
                  {done && stepNum < currentStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : stepNum}
                </div>
                <p className={`text-[10px] mt-1 hidden sm:block font-medium ${current ? 'text-[#C49A3C]' : 'text-white/40'}`}>
                  {title.split(' ')[0]}
                </p>
              </div>
            );
          })}
        </div>
        <div className="relative h-1.5 bg-white/10 rounded-full">
          <div
            className="absolute h-1.5 bg-gradient-to-r from-[#C49A3C] to-[#E8B84B] rounded-full transition-all"
            style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-4 py-3 text-sm text-[#f87171]">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="mb-6">
        {step === 0 && <Step1HouseRules data={form} onChange={updateForm} />}
        {step === 1 && <Step2Utilities data={form} onChange={updateForm} roomMeta={roomMeta} />}
        {step === 2 && <Step3Financial data={form} onChange={updateForm} />}
        {step === 3 && <Step4Maintenance data={form} onChange={updateForm} />}
        {step === 4 && <Step5Ending data={form} onChange={updateForm} />}
        {step === 5 && <Step6Deposit data={form} onChange={updateForm} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || saving}
          className="px-5 py-2.5 border border-white/10 text-white/70 rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          ← Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-[#1C2740]/30 border-t-[#1C2740] rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              'Next →'
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={saving}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              'Complete & Generate Agreement'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
