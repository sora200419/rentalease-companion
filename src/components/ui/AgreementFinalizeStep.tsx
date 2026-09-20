'use client';

import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinalizeChecklistBase {
  hasRawContent: boolean;
  isWizardComplete: boolean;
  unresolvedStructuredRequests: number;
  hasRequiredIdentityData: boolean;
  isFinalizableStatus: boolean;
}

export interface CurrentTerms {
  startDate: string;    // ISO string from Tenancy.startDate.toISOString()
  endDate: string;      // ISO string from Tenancy.endDate.toISOString()
  monthlyRent: number;
  depositAmount: number;
}

interface ExtractedTerms {
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
}

interface Props {
  agreementId: string;
  currentTerms: CurrentTerms;
  finalizeChecklistBase: FinalizeChecklistBase;
  onFinalized: () => void;
}

type Step = 'idle' | 'extracting' | 'confirming' | 'finalizing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "2026-06-01T00:00:00.000Z" → "2026-06-01" */
function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

// ─── Sub-component: single term row ──────────────────────────────────────────

function TermField({
  label,
  currentRaw,
  extractedRaw,
  inputType,
  value,
  onChange,
  prefix,
}: {
  label: string;
  currentRaw: string;        // what system currently holds (for comparison)
  extractedRaw: string | null; // what AI extracted, null = couldn't determine
  inputType: 'date' | 'number';
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
}) {
  const differs =
    extractedRaw !== null && extractedRaw !== currentRaw;
  const unknown = extractedRaw === null;

  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: differs
          ? 'rgba(251,191,36,0.06)'
          : 'rgba(196,154,60,0.04)',
        border: differs
          ? '1px solid rgba(251,191,36,0.3)'
          : '1px solid rgba(196,154,60,0.12)',
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          {label}
        </span>
        {differs && (
          <span className="text-[10px] font-semibold text-[#E8B84B]">
            ⚠ differs from system
          </span>
        )}
        {!differs && !unknown && (
          <span className="text-[10px] font-semibold text-emerald-400">
            ✓ matches
          </span>
        )}
        {unknown && (
          <span className="text-[10px] text-white/30">
            AI couldn&apos;t determine — verify
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {prefix && (
          <span className="text-[11px] text-white/40 shrink-0">{prefix}</span>
        )}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(inputType === 'number' ? { min: 0, step: '0.01' } : {})}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:border-[rgba(196,154,60,0.5)] focus:outline-none"
        />
      </div>

      {differs && (
        <p className="text-[10px] text-white/30 mt-1">
          System currently has: {currentRaw}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgreementFinalizeStep({
  agreementId,
  currentTerms,
  finalizeChecklistBase,
  onFinalized,
}: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [reviewedRedFlags, setReviewedRedFlags] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedTerms | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Editable confirmed values — pre-filled from current, overwritten after extraction
  const [confirmedStartDate, setConfirmedStartDate] = useState(
    toDateInput(currentTerms.startDate),
  );
  const [confirmedEndDate, setConfirmedEndDate] = useState(
    toDateInput(currentTerms.endDate),
  );
  const [confirmedMonthlyRent, setConfirmedMonthlyRent] = useState(
    String(currentTerms.monthlyRent),
  );
  const [confirmedDepositAmount, setConfirmedDepositAmount] = useState(
    String(currentTerms.depositAmount),
  );

  // ── Checklist ────────────────────────────────────────────────────────
  const checklistItems = useMemo(
    () => [
      {
        key: 'content',
        label: 'Agreement content is present',
        passed: finalizeChecklistBase.hasRawContent,
      },
      {
        key: 'wizard',
        label: 'Agreement wizard has been completed',
        passed: finalizeChecklistBase.isWizardComplete,
      },
      {
        key: 'identity',
        label: 'Tenant identity details are available',
        passed: finalizeChecklistBase.hasRequiredIdentityData,
      },
      {
        key: 'status',
        label: 'Agreement is in a finalizable status',
        passed: finalizeChecklistBase.isFinalizableStatus,
      },
      {
        key: 'requests',
        label:
          finalizeChecklistBase.unresolvedStructuredRequests === 0
            ? 'No unresolved structured change requests remain'
            : `${finalizeChecklistBase.unresolvedStructuredRequests} change request(s) still need attention`,
        passed: finalizeChecklistBase.unresolvedStructuredRequests === 0,
      },
      {
        key: 'review',
        label: 'Red flags reviewed before sending to tenant',
        passed: reviewedRedFlags,
      },
    ],
    [finalizeChecklistBase, reviewedRedFlags],
  );

  const checklistBlocked = checklistItems.some((item) => !item.passed);

  // ── Extraction ───────────────────────────────────────────────────────
  const handleStartFinalize = async () => {
    if (checklistBlocked) return;
    setStep('extracting');
    setExtractionFailed(false);
    try {
      const res = await fetch(
        `/api/agreements/${agreementId}/extract-terms`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error('extraction failed');
      const data: ExtractedTerms = await res.json();
      setExtracted(data);
      // Pre-fill confirmed values from extraction; fall back to current if null
      setConfirmedStartDate(
        data.startDate ?? toDateInput(currentTerms.startDate),
      );
      setConfirmedEndDate(
        data.endDate ?? toDateInput(currentTerms.endDate),
      );
      setConfirmedMonthlyRent(
        data.monthlyRent !== null
          ? String(data.monthlyRent)
          : String(currentTerms.monthlyRent),
      );
      setConfirmedDepositAmount(
        data.depositAmount !== null
          ? String(data.depositAmount)
          : String(currentTerms.depositAmount),
      );
    } catch {
      setExtractionFailed(true);
      setExtracted(null);
      // Fall back to current system values
      setConfirmedStartDate(toDateInput(currentTerms.startDate));
      setConfirmedEndDate(toDateInput(currentTerms.endDate));
      setConfirmedMonthlyRent(String(currentTerms.monthlyRent));
      setConfirmedDepositAmount(String(currentTerms.depositAmount));
    } finally {
      setStep('confirming');
    }
  };

  // ── Finalization ─────────────────────────────────────────────────────
  // Date string compare is safe — <input type="date"> emits YYYY-MM-DD, where lexical ordering equals chronological ordering.
  const confirmedValid =
    confirmedStartDate.length === 10 &&
    confirmedEndDate.length === 10 &&
    confirmedEndDate > confirmedStartDate &&
    Number(confirmedMonthlyRent) > 0 &&
    Number(confirmedDepositAmount) >= 0;

  const handleConfirmAndFinalize = async () => {
    if (!confirmedValid) return;
    setStep('finalizing');
    setFinalizeError(null);
    try {
      const res = await fetch(`/api/agreements/${agreementId}/finalize`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedRedFlags,
          confirmedTerms: {
            startDate: confirmedStartDate,
            endDate: confirmedEndDate,
            monthlyRent: Number(confirmedMonthlyRent),
            depositAmount: Number(confirmedDepositAmount),
          },
        }),
      });
      if (!res.ok) {
        let errorMsg = 'Failed to finalize';
        try {
          const errBody = await res.json();
          errorMsg = errBody.error || errorMsg;
        } catch { /* non-JSON body — keep default message */ }
        setFinalizeError(errorMsg);
        setStep('confirming');
        return;
      }
      onFinalized();
    } catch {
      setFinalizeError('Network error. Please try again.');
      setStep('confirming');
    }
  };

  // Snapshot the current raw values for comparison in TermField
  const currentStartRaw = toDateInput(currentTerms.startDate);
  const currentEndRaw = toDateInput(currentTerms.endDate);
  const currentRentRaw = String(currentTerms.monthlyRent);
  const currentDepositRaw = String(currentTerms.depositAmount);

  // ── Render: idle ─────────────────────────────────────────────────────
  if (step === 'idle') {
    return (
      <div className="px-4 py-4 space-y-2">
        {checklistItems.map((item) => (
          <div
            key={item.key}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-medium leading-snug ${
              item.passed ? 'av-checklist-pass' : 'av-checklist-fail'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                item.passed
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {item.passed ? '✓' : '!'}
            </div>
            {item.label}
          </div>
        ))}

        <label
          className="flex items-start gap-2.5 px-3 py-3 rounded-xl cursor-pointer"
          style={{
            background: 'rgba(196,154,60,0.07)',
            border: '1px solid rgba(196,154,60,0.18)',
          }}
        >
          <input
            type="checkbox"
            checked={reviewedRedFlags}
            onChange={(e) => setReviewedRedFlags(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 shrink-0 accent-amber-500"
          />
          <span className="text-[11px] text-gray-400 leading-relaxed">
            I have reviewed the red-flag analysis and am ready to send this
            agreement to the tenant.
          </span>
        </label>

        <button
          onClick={handleStartFinalize}
          disabled={checklistBlocked}
          className="av-finalize-btn w-full text-sm px-4 py-3 rounded-xl"
        >
          Send Finalized Agreement
        </button>
      </div>
    );
  }

  // ── Render: extracting ───────────────────────────────────────────────
  if (step === 'extracting') {
    return (
      <div className="px-4 py-6">
        <div
          className="rounded-xl px-4 py-5 flex items-center gap-3"
          style={{
            background: 'rgba(196,154,60,0.06)',
            border: '1px solid rgba(196,154,60,0.2)',
          }}
        >
          <svg
            className="w-4 h-4 animate-spin shrink-0"
            style={{ color: '#C49A3C' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <div>
            <p className="text-[11px] font-semibold" style={{ color: '#C49A3C' }}>
              Reading agreement terms…
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: 'rgba(196,154,60,0.6)' }}
            >
              AI is extracting dates and amounts from your agreement text
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: confirming / finalizing ──────────────────────────────────
  const extractedStartRaw =
    extracted?.startDate ?? null;
  const extractedEndRaw =
    extracted?.endDate ?? null;
  const extractedRentRaw =
    extracted?.monthlyRent !== null && extracted?.monthlyRent !== undefined
      ? String(extracted.monthlyRent)
      : null;
  const extractedDepositRaw =
    extracted?.depositAmount !== null && extracted?.depositAmount !== undefined
      ? String(extracted.depositAmount)
      : null;

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Banner */}
      {extractionFailed ? (
        <div
          className="rounded-xl px-3 py-2.5 text-[11px]"
          style={{
            background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.25)',
          }}
        >
          <p className="font-semibold text-[#E8B84B]">
            AI extraction failed — please verify all values manually
          </p>
          <p className="mt-0.5" style={{ color: 'rgba(232,184,75,0.7)' }}>
            Fields are pre-filled with current system values.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl px-3 py-2.5 text-[11px]"
          style={{
            background: 'rgba(196,154,60,0.06)',
            border: '1px solid rgba(196,154,60,0.18)',
          }}
        >
          <p className="font-semibold text-[#C49A3C]">
            Review terms before finalizing
          </p>
          <p className="mt-0.5" style={{ color: 'rgba(196,154,60,0.7)' }}>
            AI read your agreement. Correct anything that looks wrong.
          </p>
        </div>
      )}

      {/* Four term fields */}
      <div className="space-y-2">
        <TermField
          label="Start date"
          currentRaw={currentStartRaw}
          extractedRaw={extractedStartRaw}
          inputType="date"
          value={confirmedStartDate}
          onChange={setConfirmedStartDate}
        />
        <TermField
          label="End date"
          currentRaw={currentEndRaw}
          extractedRaw={extractedEndRaw}
          inputType="date"
          value={confirmedEndDate}
          onChange={setConfirmedEndDate}
        />
        <TermField
          label="Monthly rent"
          currentRaw={currentRentRaw}
          extractedRaw={extractedRentRaw}
          inputType="number"
          value={confirmedMonthlyRent}
          onChange={setConfirmedMonthlyRent}
          prefix="RM"
        />
        <TermField
          label="Security deposit"
          currentRaw={currentDepositRaw}
          extractedRaw={extractedDepositRaw}
          inputType="number"
          value={confirmedDepositAmount}
          onChange={setConfirmedDepositAmount}
          prefix="RM"
        />
      </div>

      {finalizeError && (
        <div
          className="rounded-xl px-3 py-2.5 text-[11px] text-red-400"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {finalizeError}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => {
            setStep('idle');
            setFinalizeError(null);
          }}
          disabled={step === 'finalizing'}
          className="flex-1 text-[11px] font-medium rounded-xl py-2.5"
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Back
        </button>
        <button
          onClick={handleConfirmAndFinalize}
          disabled={!confirmedValid || step === 'finalizing'}
          className="av-finalize-btn flex-1 text-sm px-4 py-2.5 rounded-xl"
        >
          {step === 'finalizing' ? 'Finalizing…' : 'Confirm & Finalize'}
        </button>
      </div>
    </div>
  );
}
