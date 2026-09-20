'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  agreementId: string;
  currentVersion?: number;
  isCorporate?: boolean;
  signerLabel?: string;
}

type Mode = 'idle' | 'signing' | 'requesting_changes';

type ChangeRequestDraft = {
  category: string;
  requestedChange: string;
  reason: string;
  note: string;
};

const EMPTY_REQUEST: ChangeRequestDraft = {
  category: 'Rent and payments',
  requestedChange: '',
  reason: '',
  note: '',
};

const CATEGORY_OPTIONS = [
  'Rent and payments',
  'Deposit terms',
  'Notice period',
  'House rules',
  'Repairs and maintenance',
  'Utilities and services',
  'Occupancy and guests',
  'Other clause',
];

export default function TenantAgreementActions({
  agreementId,
  currentVersion = 1,
  isCorporate = false,
  signerLabel = 'authorized signatory',
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [acknowledged, setAcknowledged] = useState(false);
  const [generalNote, setGeneralNote] = useState('');
  const [changeRequests, setChangeRequests] = useState<ChangeRequestDraft[]>([
    EMPTY_REQUEST,
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasValidChangeRequest = changeRequests.some(
    (request) =>
      request.category.trim() &&
      request.requestedChange.trim().length >= 5 &&
      request.reason.trim().length >= 5,
  );

  const handleAccept = async () => {
    if (!acknowledged) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreements/${agreementId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SIGN', signedAcknowledged: true }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Something went wrong.');
        return;
      }

      setSuccess(
        'Digital signature recorded. Upload your signed hard-copy file next so the landlord can approve it before the tenancy starts.',
      );
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/agreements/${agreementId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_CHANGES',
          negotiationNotes: generalNote,
          changeRequests,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Something went wrong.');
        return;
      }

      setSuccess('Your structured change request has been sent to the landlord.');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-xl px-5 py-4 flex items-center gap-3">
        <svg
          className="w-5 h-5 text-[#4ade80] shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <p className="text-[#4ade80] font-medium text-sm">{success}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
            Your Response
          </h2>
          <p className="text-sm text-white/60 mt-2">
            You are reviewing Version {currentVersion}. Read the agreement,
            plain language summary, red-flag analysis, and history before
            choosing your next step.
          </p>
        </div>
      </div>

      {mode === 'idle' && (
        <div>
          <div className="bg-white/[0.03] border border-[rgba(196,154,60,0.15)] rounded-xl px-4 py-4 mb-5">
            <p className="text-sm font-semibold text-white">
              Final decision options
            </p>
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
              Signing records your digital acceptance first. You will still
              need to upload the signed hard-copy file, and the landlord must
              approve it before the tenancy activates. Requesting changes sends
              a structured negotiation record back to the landlord for revision.
            </p>
            {isCorporate && (
              <p className="text-xs text-[#C49A3C] mt-2 leading-relaxed">
                Only the authorized signatory can complete the legal signing or
                submit binding agreement changes for this corporate tenancy.
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setMode('signing')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {isCorporate
                ? 'Review and Sign as Authorized Signatory'
                : 'Review and Sign'}
            </button>
            <button
              onClick={() => setMode('requesting_changes')}
              className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Request Structured Changes
            </button>
          </div>
        </div>
      )}

      {mode === 'signing' && (
        <div>
          <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-xl px-5 py-4 mb-5">
            <p className="text-[#E8B84B] font-semibold text-sm mb-1">
              Final signing step
            </p>
            <p className="text-[#E8B84B] text-xs leading-relaxed">
              By signing, you confirm that you reviewed this agreement version,
              understood its terms, and accept the digital-signing step for
              this tenancy. After that, you must upload the signed hard-copy
              file for landlord approval.
            </p>
            {isCorporate && (
              <p className="text-[#E8B84B] text-xs leading-relaxed mt-2">
                This signature is being captured in your role as the authorized
                signatory for the lease party, not as an occupant.
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 p-4 bg-white/[0.03] rounded-xl border border-[rgba(196,154,60,0.15)] cursor-pointer mb-5">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 accent-green-600 w-4 h-4 shrink-0"
            />
            <span className="text-sm text-white/70 leading-relaxed">
              I have reviewed Version {currentVersion} of this agreement, the
              plain-language summary, and the red-flag analysis. I understand
              the terms and agree to sign electronically
              {isCorporate
                ? ` as the ${signerLabel} for this corporate tenancy.`
                : '.'}
            </span>
          </label>

          {error && <p className="text-[#f87171] text-sm mb-4">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setMode('idle');
                setAcknowledged(false);
                setError(null);
              }}
              disabled={isLoading}
              className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleAccept}
              disabled={!acknowledged || isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {isLoading
                ? 'Processing...'
                : isCorporate
                  ? 'Confirm and Sign as Authorized Signatory'
                  : 'Confirm and Sign Agreement'}
            </button>
          </div>
        </div>
      )}

      {mode === 'requesting_changes' && (
        <div className="space-y-4">
          <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-xl px-4 py-4">
            <p className="text-sm font-semibold text-[#C49A3C]">
              Structured change request
            </p>
            <p className="text-xs text-[#C49A3C] mt-1 leading-relaxed">
              Add one or more clause requests so the landlord can see exactly
              what needs to be revised. You can include an optional general note
              at the end.
            </p>
          </div>

          {changeRequests.map((request, index) => (
            <div
              key={index}
              className="border border-[rgba(196,154,60,0.15)] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Request {index + 1}
                </p>
                {changeRequests.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setChangeRequests((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    className="text-xs font-medium text-[#f87171] hover:opacity-80"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">
                  Clause / section category
                </label>
                <select
                  value={request.category}
                  onChange={(event) =>
                    setChangeRequests((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, category: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#1C2740] text-white px-3 py-2 text-sm focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">
                  What should change?
                </label>
                <textarea
                  value={request.requestedChange}
                  onChange={(event) =>
                    setChangeRequests((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? {
                              ...item,
                              requestedChange: event.target.value,
                            }
                          : item,
                      ),
                    )
                  }
                  rows={2}
                  placeholder="Example: Reduce the security deposit from 3 months to 2 months."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">
                  Why are you requesting this change?
                </label>
                <textarea
                  value={request.reason}
                  onChange={(event) =>
                    setChangeRequests((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, reason: event.target.value }
                          : item,
                      ),
                    )
                  }
                  rows={2}
                  placeholder="Explain the concern so the landlord understands the request."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">
                  Optional note
                </label>
                <textarea
                  value={request.note}
                  onChange={(event) =>
                    setChangeRequests((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, note: event.target.value }
                          : item,
                      ),
                    )
                  }
                  rows={2}
                  placeholder="Any extra context or example wording."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setChangeRequests((current) => [...current, { ...EMPTY_REQUEST }])
            }
            className="text-sm font-medium text-[#C49A3C] hover:opacity-80"
          >
            + Add another change request
          </button>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">
              Optional general note to landlord
            </label>
            <textarea
              value={generalNote}
              onChange={(event) => setGeneralNote(event.target.value)}
              rows={3}
              placeholder="Optional summary note covering the overall negotiation."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
            />
          </div>

          {error && <p className="text-[#f87171] text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setMode('idle');
                setError(null);
              }}
              disabled={isLoading}
              className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={isLoading || !hasValidChangeRequest}
              className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Sending...' : 'Send Change Request'}
            </button>
          </div>
        </div>
      )}

      {error && mode === 'idle' && (
        <p className="text-[#f87171] text-sm mt-3">{error}</p>
      )}
    </div>
  );
}
