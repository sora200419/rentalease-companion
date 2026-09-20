'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  reportId: string;
  mode?: 'initial-review' | 'counter-review';
}

type Action = 'accept' | 'correction' | 'counter' | null;

export default function ConditionReviewActions({
  reportId,
  mode = 'initial-review',
}: Props) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<Action>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    setActiveAction('accept');
    try {
      const res = await fetch(`/api/condition-reports/${reportId}/accept`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to accept.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCorrection = async () => {
    if (!correctionNote.trim()) {
      setError('Please describe what needs to be corrected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/condition-reports/${reportId}/request-correction`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correctionNote: correctionNote.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to request correction.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCounterEvidence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/condition-reports/${reportId}/counter-evidence`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ counterNote: counterNote.trim() || null }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to submit counter evidence.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeDispute = async () => {
    setLoading(true);
    setError(null);
    setActiveAction('counter');
    try {
      const res = await fetch(
        `/api/condition-reports/${reportId}/finalize-dispute`,
        {
          method: 'PATCH',
        },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to mark disputed.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-white/70">
        {mode === 'counter-review'
          ? 'Review the counter evidence and choose an action:'
          : 'Review this report and choose an action:'}
      </p>

      <div className="rounded-lg border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#4ade80]">
              {mode === 'counter-review'
                ? 'Accept Counter Evidence'
                : 'Accept Report'}
            </p>
            <p className="mt-0.5 text-xs text-[#4ade80]">
              {mode === 'counter-review'
                ? 'Confirms you reviewed the counter evidence and agree to close this record.'
                : 'Confirms you reviewed the evidence and agree with the documented condition.'}
            </p>
          </div>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="ml-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {loading && activeAction === 'accept' ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      </div>

      {mode === 'initial-review' && (
        <>
          <div className="rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.08)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#E8B84B]">
                  Request Correction
                </p>
                <p className="mt-0.5 text-xs text-[#E8B84B]">
                  Ask the creator to add missing or clearer evidence.
                </p>
              </div>
              <button
                onClick={() =>
                  setActiveAction(
                    activeAction === 'correction' ? null : 'correction',
                  )
                }
                className="ml-4 rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-[#E8B84B] transition-colors hover:bg-[rgba(251,191,36,0.08)]"
              >
                Request
              </button>
            </div>
            {activeAction === 'correction' && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="e.g. Missing bathroom photos. The wall photo is too blurry."
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0"
                />
                <button
                  onClick={handleRequestCorrection}
                  disabled={loading}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {loading && activeAction === 'correction'
                    ? 'Sending...'
                    : 'Send Request'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#f87171]">
                  Add Counter Evidence
                </p>
                <p className="mt-0.5 text-xs text-[#f87171]">
                  Upload your own photos with Add Photos, then submit a note
                  explaining your disagreement.
                </p>
              </div>
              <button
                onClick={() =>
                  setActiveAction(activeAction === 'counter' ? null : 'counter')
                }
                className="ml-4 rounded-lg border border-[rgba(248,113,113,0.25)] px-4 py-2 text-sm font-medium text-[#f87171] transition-colors hover:bg-[rgba(248,113,113,0.08)]"
              >
                Dispute
              </button>
            </div>
            {activeAction === 'counter' && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder="e.g. The wall damage shown was pre-existing when I moved in."
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0"
                />
                <button
                  onClick={handleCounterEvidence}
                  disabled={loading}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {loading && activeAction === 'counter'
                    ? 'Submitting...'
                    : 'Submit Counter Evidence'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'counter-review' && (
        <div className="rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#f87171]">
                Keep Disputed
              </p>
              <p className="mt-0.5 text-xs text-[#f87171]">
                Close this report as unresolved after reviewing the counter
                evidence.
              </p>
            </div>
            <button
              onClick={handleFinalizeDispute}
              disabled={loading}
              className="ml-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {loading && activeAction === 'counter'
                ? 'Marking...'
                : 'Mark Disputed'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[#f87171]">{error}</p>}
    </div>
  );
}
