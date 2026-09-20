'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLifecycleCompletionState,
  type DeductionEvidencePhoto,
} from '@/lib/depositSettlementWorkflow';

type DeductionStatus = 'PROPOSED' | 'ACCEPTED' | 'DISPUTED' | 'WITHDRAWN';
type RefundStatus = 'PROPOSED' | 'IN_REVIEW' | 'AGREED' | 'DISPUTED' | 'PAID';

interface Deduction {
  id: string;
  reason: string;
  amount: number;
  status: DeductionStatus;
  tenantDisputeNote?: string | null;
  evidencePhotos?: DeductionEvidencePhoto[];
}

interface Refund {
  id: string;
  status: RefundStatus;
  originalAmount: number;
  refundAmount: number;
  paidAt?: string | null;
  paidProofUrl?: string | null;
  deductions: Deduction[];
}

interface Props {
  refund: Refund;
}

const STATUS_LABEL: Record<RefundStatus, string> = {
  PROPOSED: 'Awaiting your review',
  IN_REVIEW: 'Under review',
  AGREED: 'Agreed — awaiting payment',
  DISPUTED: 'Dispute raised',
  PAID: 'Refund paid',
};

const STATUS_STYLE: Record<RefundStatus, string> = {
  PROPOSED: 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]',
  IN_REVIEW: 'bg-[rgba(196,154,60,0.1)] text-[#C49A3C]',
  AGREED: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]',
  DISPUTED: 'bg-[rgba(248,113,113,0.1)] text-[#f87171]',
  PAID: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]',
};

export default function TenantDepositReview({ refund: initialRefund }: Props) {
  const router = useRouter();
  const [refund, setRefund] = useState<Refund>(initialRefund);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatRM = (n: number) =>
    `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const respond = async (deductionId: string, action: 'ACCEPT' | 'DISPUTE') => {
    setResponding(deductionId);
    setError(null);
    try {
      const res = await fetch(`/api/deposit-refund/${refund.id}/deductions/${deductionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          disputeNote: action === 'DISPUTE' ? disputeNotes[deductionId] : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');

      const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DISPUTED';
      setRefund((prev) => ({
        ...prev,
        deductions: prev.deductions.map((d) =>
          d.id === deductionId
            ? { ...d, status: newStatus as DeductionStatus, tenantDisputeNote: disputeNotes[deductionId] ?? null }
            : d
        ),
        status: 'IN_REVIEW',
      }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setResponding(null);
    }
  };

  const pendingDeductions = refund.deductions.filter((d) => d.status === 'PROPOSED');
  const lifecycleCompletion = getLifecycleCompletionState(refund.status);

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
          Deposit Settlement
        </h2>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[refund.status]}`}>
          {STATUS_LABEL[refund.status]}
        </span>
      </div>

      {lifecycleCompletion && (
        <div className="rounded-lg border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-4 py-3">
          <p className="text-sm font-semibold text-[#4ade80]">
            {lifecycleCompletion.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#4ade80]">
            {lifecycleCompletion.message}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/40 text-xs">Original deposit</p>
          <p className="font-semibold text-white">{formatRM(refund.originalAmount)}</p>
        </div>
        <div>
          <p className="text-white/40 text-xs">Refund amount</p>
          <p className={`font-bold text-lg ${refund.refundAmount === 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
            {formatRM(refund.refundAmount)}
          </p>
        </div>
      </div>

      {refund.deductions.length > 0 && (
        <div className="space-y-3 border-t border-[rgba(196,154,60,0.1)] pt-4">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Deductions proposed by landlord</p>

          {refund.deductions
            .filter((d) => d.status !== 'WITHDRAWN')
            .map((d) => (
              <div key={d.id} className="border border-[rgba(196,154,60,0.1)] rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-white flex-1">{d.reason}</p>
                  <span className="text-sm font-semibold text-white ml-3">{formatRM(d.amount)}</span>
                </div>

                {d.evidencePhotos && d.evidencePhotos.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-xs font-medium text-white/40">
                      Attached evidence
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {d.evidencePhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          title={photo.area}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.imageUrl}
                            alt={`Evidence photo for ${photo.area}`}
                            className="h-16 w-16 rounded-lg border border-[rgba(196,154,60,0.2)] object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {d.status === 'PROPOSED' ? (
                  <div className="space-y-2">
                    <textarea
                      value={disputeNotes[d.id] ?? ''}
                      onChange={(e) => setDisputeNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      placeholder="Note (required if disputing)…"
                      rows={2}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(d.id, 'ACCEPT')}
                        disabled={responding === d.id}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs"
                      >
                        {responding === d.id ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => respond(d.id, 'DISPUTE')}
                        disabled={responding === d.id || !disputeNotes[d.id]?.trim()}
                        className="flex-1 bg-[rgba(248,113,113,0.08)] hover:bg-[rgba(248,113,113,0.1)] disabled:opacity-50 text-[#f87171] font-semibold px-3 py-1.5 rounded-lg text-xs border border-[rgba(248,113,113,0.25)]"
                      >
                        {responding === d.id ? '…' : 'Dispute'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <span className={`text-xs font-medium ${d.status === 'ACCEPTED' ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                      {d.status === 'ACCEPTED' ? 'You accepted this deduction' : 'You disputed this deduction'}
                    </span>
                    {d.tenantDisputeNote && (
                      <p className="text-xs text-white/50 mt-0.5">Your note: &quot;{d.tenantDisputeNote}&quot;</p>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {pendingDeductions.length === 0 && refund.status === 'IN_REVIEW' && (
        <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 text-xs text-[#C49A3C]">
          All deductions reviewed. Waiting for landlord to finalise the settlement.
        </div>
      )}

      {refund.status === 'AGREED' && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-lg px-4 py-3 text-xs text-[#4ade80]">
          Settlement agreed. Your landlord will transfer {formatRM(refund.refundAmount)} to you.
        </div>
      )}

      {refund.status === 'PAID' && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-lg px-4 py-3">
          <p className="text-xs text-[#4ade80] font-semibold">Refund paid</p>
          {refund.paidAt && (
            <p className="text-xs text-[#4ade80]">
              {new Date(refund.paidAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {refund.paidProofUrl && (
            <a href={refund.paidProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C49A3C] hover:underline">
              View proof ↗
            </a>
          )}
        </div>
      )}

      {error && <p className="text-[#f87171] text-xs">{error}</p>}
    </div>
  );
}
