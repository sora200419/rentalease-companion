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
  paymentId: string;
  dueDate: string; // pre-formatted date string from server
  amount: string; // pre-formatted RM amount from server
  status: string;
  proofs: Proof[];
}

export default function PaymentVerificationCard({
  paymentId,
  dueDate,
  amount,
  status,
  proofs,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [rejectReason, setRejectReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (action: 'approve' | 'reject') => {
    setIsLoading(true);
    setError(null);

    const apiAction = action === 'approve' ? 'APPROVE' : 'REJECT';
    const body =
      action === 'approve'
        ? { action: apiAction }
        : { action: apiAction, rejectionReason: rejectReason };

    try {
      const response = await fetch(`/api/payments/${paymentId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

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
      {/* Payment header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold text-white text-sm">{dueDate}</p>
          <p className="text-white/40 text-xs mt-0.5">{amount}</p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            status === 'PAID'
              ? 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]'
              : status === 'UNDER_REVIEW'
                ? 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]'
                : status === 'LATE'
                  ? 'bg-[rgba(248,113,113,0.1)] text-[#f87171]'
                  : 'bg-white/5 text-white/50'
          }`}
        >
          {status === 'UNDER_REVIEW'
            ? 'Under Review'
            : status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>

      {/* Proof thumbnails — clicking opens full size in new tab */}
      {proofs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 mb-4">
          {proofs.map((proof, index) => (
            <a
              key={proof.id}
              href={proof.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View payment proof ${index + 1}`}
              className={index === 0 ? 'sm:col-span-2' : ''}
            >
              <Image
                src={proof.imageUrl}
                alt={`Payment proof ${index + 1}`}
                width={index === 0 ? 800 : 400}
                height={index === 0 ? 224 : 128}
                className={`w-full rounded-lg object-cover ${index === 0 ? 'h-56' : 'h-32'}`}
              />
            </a>
          ))}
        </div>
      )}

      {/* Action area — only shown when payment is UNDER_REVIEW */}
      {status === 'UNDER_REVIEW' && mode === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleVerify('approve')}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {isLoading ? 'Processing…' : 'Approve'}
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

      {/* Rejection reason input — expands inline */}
      {status === 'UNDER_REVIEW' && mode === 'rejecting' && (
        <div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Explain why the proof is insufficient, e.g. 'The photo is blurry and the amount is not visible. Please re-upload a clearer screenshot.'"
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
              onClick={() => handleVerify('reject')}
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
