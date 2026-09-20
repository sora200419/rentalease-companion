'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Proof {
  id: string;
  imageUrl: string;
  createdAt: Date;
}

interface Props {
  tenancyId: string;
  depositAmount: string;
  depositStatus: string;
  proofs: Proof[];
  rejectionReason?: string | null;
}

export default function DepositVerificationCard({
  tenancyId,
  depositAmount,
  depositStatus,
  proofs,
  rejectionReason,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [rejectReason, setRejectReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (action: 'APPROVE' | 'REJECT') => {
    setIsLoading(true);
    setError(null);

    const body =
      action === 'APPROVE'
        ? { action }
        : { action, rejectionReason: rejectReason };

    try {
      const res = await fetch(
        `/api/tenancies/${tenancyId}/deposit-proof/verify`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const result = await res.json();
      if (!res.ok) {
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

  const statusBadge: Record<string, string> = {
    PENDING: 'bg-white/5 text-white/50',
    UNDER_REVIEW: 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]',
    PAID: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]',
    REJECTED: 'bg-[rgba(248,113,113,0.1)] text-[#f87171]',
  };

  const statusLabel: Record<string, string> = {
    PENDING: 'Pending',
    UNDER_REVIEW: 'Under Review',
    PAID: 'Paid',
    REJECTED: 'Rejected',
  };

  return (
    <div className="mt-4 border-t border-[rgba(196,154,60,0.1)] pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white/70">
          Deposit — {depositAmount}
        </p>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[depositStatus] ?? 'bg-white/5 text-white/50'}`}
        >
          {statusLabel[depositStatus] ?? depositStatus}
        </span>
      </div>

      {depositStatus === 'REJECTED' && rejectionReason && (
        <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-[#f87171]">
            <span className="font-semibold">Rejected:</span> {rejectionReason}
          </p>
        </div>
      )}

      {proofs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          {proofs.map((proof, index) => (
            <a
              key={proof.id}
              href={proof.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View deposit proof ${index + 1}`}
              className={index === 0 ? 'sm:col-span-2' : ''}
            >
              <Image
                src={proof.imageUrl}
                alt={`Deposit proof ${index + 1}`}
                width={index === 0 ? 800 : 400}
                height={index === 0 ? 224 : 128}
                className={`w-full rounded-lg object-cover ${index === 0 ? 'h-56' : 'h-32'}`}
              />
            </a>
          ))}
        </div>
      )}

      {depositStatus === 'PENDING' && (
        <p className="text-xs text-white/40 italic">
          Tenant has not uploaded deposit proof yet.
        </p>
      )}

      {depositStatus === 'UNDER_REVIEW' && mode === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleVerify('APPROVE')}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {isLoading ? 'Processing…' : 'Confirm Paid'}
          </button>
          <button
            onClick={() => setMode('rejecting')}
            disabled={isLoading}
            className="flex-1 border border-[rgba(248,113,113,0.25)] text-[#f87171] hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-50 text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            Reject
          </button>
        </div>
      )}

      {depositStatus === 'UNDER_REVIEW' && mode === 'rejecting' && (
        <div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Explain why the proof is insufficient…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode('idle');
                setRejectReason('');
              }}
              disabled={isLoading}
              className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVerify('REJECT')}
              disabled={isLoading || rejectReason.trim().length < 10}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {isLoading ? 'Sending…' : 'Send Rejection'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
    </div>
  );
}
