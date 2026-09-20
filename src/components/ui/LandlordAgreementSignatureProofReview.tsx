'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SignatureProofSummary {
  id: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  createdAt: Date | string;
  reviewedAt?: Date | string | null;
}

interface Props {
  agreementId: string;
  proof: SignatureProofSummary | null;
  tenantName: string;
}

export default function LandlordAgreementSignatureProofReview({
  agreementId,
  proof,
  tenantName,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!proof) {
    return (
      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          Signature Proof Review
        </h2>
        <div className="rounded-xl border border-dashed border-[rgba(196,154,60,0.15)] px-4 py-5 text-sm text-white/50">
          {tenantName} has completed digital signing, but has not uploaded the
          signed hard-copy file yet.
        </div>
      </div>
    );
  }

  const handleReview = async (action: 'APPROVE' | 'REJECT') => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/agreements/${agreementId}/signature-proof/${proof.id}/review`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'APPROVE'
              ? { action }
              : { action, rejectionReason },
          ),
        },
      );

      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Signature Proof Review
          </h2>
          <p className="text-sm text-white/60 mt-2">
            Review the uploaded signed hard-copy agreement before the tenancy
            becomes active.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            proof.status === 'APPROVED'
              ? 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset'
              : proof.status === 'REJECTED'
                ? 'bg-[rgba(248,113,113,0.1)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.25)] ring-inset'
                : 'bg-[rgba(196,154,60,0.1)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.2)] ring-inset'
          }`}
        >
          {proof.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-white/[0.03] px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              {proof.originalName}
            </p>
            <p className="text-xs text-white/50 mt-1">
              Uploaded on {new Date(proof.createdAt).toLocaleString('en-MY')}
            </p>
            <p className="text-xs text-white/50 mt-1">
              {(proof.fileSize / (1024 * 1024)).toFixed(2)} MB · {proof.mimeType}
            </p>
            {proof.rejectionReason && (
              <p className="text-xs text-[#f87171] mt-2">
                <span className="font-semibold">Last rejection reason:</span>{' '}
                {proof.rejectionReason}
              </p>
            )}
          </div>
          <a
            href={proof.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-white/10 bg-[#1C2740] px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 transition-colors"
          >
            Open File
          </a>
        </div>
      </div>

      {proof.status === 'UNDER_REVIEW' && mode === 'idle' && (
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => handleReview('APPROVE')}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Processing…' : 'Approve Signed Copy'}
          </button>
          <button
            type="button"
            onClick={() => setMode('rejecting')}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-[rgba(248,113,113,0.25)] px-4 py-2.5 text-sm font-semibold text-[#f87171] hover:bg-[rgba(248,113,113,0.08)] transition-colors"
          >
            Reject and Request Re-upload
          </button>
        </div>
      )}

      {proof.status === 'UNDER_REVIEW' && mode === 'rejecting' && (
        <div className="mt-4 space-y-3">
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={3}
            placeholder="Explain what is missing or incorrect about the uploaded signed copy…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(248,113,113,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setRejectionReason('');
                setError(null);
              }}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleReview('REJECT')}
              disabled={isLoading || rejectionReason.trim().length < 10}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Sending…' : 'Send Rejection'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[#f87171] mt-3">{error}</p>}
    </div>
  );
}
