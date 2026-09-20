'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  canLandlordWithdrawDeduction,
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
  paidAt: string | null;
  paidProofUrl: string | null;
  deductions: Deduction[];
}

interface MoveOutPhoto {
  id: string;
  area: string;
  imageUrl: string;
}

interface Props {
  tenancyId: string;
  tenantName: string;
  existingRefund: Refund | null;
  moveOutPhotos: MoveOutPhoto[];
}

const STATUS_LABEL: Record<RefundStatus, string> = {
  PROPOSED: 'Proposed',
  IN_REVIEW: 'Under Review',
  AGREED: 'Agreed',
  DISPUTED: 'Disputed',
  PAID: 'Paid',
};

const STATUS_STYLE: Record<RefundStatus, string> = {
  PROPOSED: 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]',
  IN_REVIEW: 'bg-[rgba(196,154,60,0.1)] text-[#C49A3C]',
  AGREED: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]',
  DISPUTED: 'bg-[rgba(248,113,113,0.1)] text-[#f87171]',
  PAID: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]',
};

const DEDUCTION_STYLE: Record<DeductionStatus, string> = {
  PROPOSED: 'text-[#E8B84B]',
  ACCEPTED: 'text-[#4ade80]',
  DISPUTED: 'text-[#f87171]',
  WITHDRAWN: 'text-white/30 line-through',
};

export default function DepositSettlementClient({
  tenancyId,
  tenantName,
  existingRefund: initialRefund,
  moveOutPhotos,
}: Props) {
  const router = useRouter();
  const [refund, setRefund] = useState<Refund | null>(initialRefund);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New deduction form
  const [newReason, setNewReason] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [addingDeduction, setAddingDeduction] = useState(false);

  // Mark-paid proof upload
  const proofFileRef = useRef<HTMLInputElement>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const formatRM = (n: number) =>
    `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  // Create initial refund record
  const createRefund = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deposit-refund/${tenancyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deductions: [] }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const data = await res.json();
      setRefund(data.refund);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Add a deduction
  const addDeduction = async () => {
    if (!refund || !newReason.trim() || !newAmount) return;
    setAddingDeduction(true);
    setError(null);
    try {
      const res = await fetch(`/api/deposit-refund/${refund.id}/deductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: newReason.trim(),
          amount: parseFloat(newAmount),
          photoIds: selectedPhotos,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const data = await res.json();
      setRefund((prev) => {
        if (!prev) return prev;
        const newTotal = [...prev.deductions, data.deduction]
          .filter((d) => d.status !== 'WITHDRAWN')
          .reduce((s, d) => s + d.amount, 0);
        return {
          ...prev,
          deductions: [...prev.deductions, data.deduction],
          refundAmount: Math.max(0, prev.originalAmount - newTotal),
        };
      });
      setNewReason('');
      setNewAmount('');
      setSelectedPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setAddingDeduction(false);
    }
  };

  // Withdraw a deduction
  const withdrawDeduction = async (deductionId: string) => {
    if (!refund) return;
    setError(null);
    try {
      const res = await fetch(`/api/deposit-refund/${refund.id}/deductions/${deductionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'WITHDRAW' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const data = await res.json();
      setRefund((prev) => {
        if (!prev) return prev;
        const updated = prev.deductions.map((d) =>
          d.id === deductionId ? { ...d, status: 'WITHDRAWN' as DeductionStatus } : d
        );
        const newTotal = updated
          .filter((d) => d.status !== 'WITHDRAWN')
          .reduce((s, d) => s + d.amount, 0);
        return {
          ...prev,
          deductions: updated,
          refundAmount: data.refund?.refundAmount !== undefined
            ? Number(data.refund.refundAmount)
            : Math.max(0, prev.originalAmount - newTotal),
          status: data.refund?.status ?? prev.status,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  // Upload paid proof
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!refund || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingProof(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/deposit-refund/${refund.id}/mark-paid`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed');
      setRefund((prev) => prev ? { ...prev, status: 'PAID', paidAt: new Date().toISOString() } : prev);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setUploadingProof(false);
      if (proofFileRef.current) proofFileRef.current.value = '';
    }
  };

  if (!refund) {
    return (
      <div className="space-y-5">
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6 text-center">
          <svg className="w-10 h-10 text-white/30 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-semibold text-white">Start deposit settlement</p>
          <p className="text-sm text-white/40 mt-1 mb-5">
            Create a deposit refund record. You can then add deductions for any damages or unpaid amounts, and {tenantName} will be notified to review.
          </p>
          {error && <p className="text-[#f87171] text-sm mb-3">{error}</p>}
          <button
            onClick={createRefund}
            disabled={loading}
            className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] font-semibold px-6 py-2.5 rounded-lg text-sm"
          >
            {loading ? 'Creating…' : '→ Start Settlement'}
          </button>
        </div>
      </div>
    );
  }

  const activeDeductions = refund.deductions.filter((d) => d.status !== 'WITHDRAWN');
  const canAddDeductions = ['PROPOSED', 'IN_REVIEW'].includes(refund.status);
  const canWithdrawDeductions = ['PROPOSED', 'IN_REVIEW', 'DISPUTED'].includes(refund.status);
  const canMarkPaid = refund.status === 'AGREED';
  const lifecycleCompletion = getLifecycleCompletionState(refund.status);

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/40">Refund Status</p>
          <span className={`inline-block mt-1 text-sm font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[refund.status]}`}>
            {STATUS_LABEL[refund.status]}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/40">Original deposit</p>
          <p className="font-semibold text-white">{formatRM(refund.originalAmount)}</p>
          <p className="text-xs text-white/40 mt-2">Refund amount</p>
          <p className={`font-bold text-lg ${refund.refundAmount === 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
            {formatRM(refund.refundAmount)}
          </p>
        </div>
      </div>

      {lifecycleCompletion && (
        <div className="rounded-xl border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-5 py-4">
          <p className="text-sm font-semibold text-[#4ade80]">
            {lifecycleCompletion.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#4ade80]">
            {lifecycleCompletion.message}
          </p>
        </div>
      )}

      {/* Deductions list */}
      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Deductions
        </h2>

        {refund.deductions.length === 0 && (
          <p className="text-sm text-white/40 mb-4">No deductions added. Full deposit will be refunded.</p>
        )}

        {refund.deductions.length > 0 && (
          <div className="space-y-3 mb-4">
            {refund.deductions.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.06] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${d.status === 'WITHDRAWN' ? 'text-white/30 line-through' : 'text-white'}`}>
                    {d.reason}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${DEDUCTION_STYLE[d.status]}`}>
                      {d.status === 'PROPOSED' ? 'Pending response' :
                       d.status === 'ACCEPTED' ? 'Accepted' :
                       d.status === 'DISPUTED' ? 'Disputed' : 'Withdrawn'}
                    </span>
                    {d.tenantDisputeNote && (
                      <span className="text-xs text-[#f87171] truncate max-w-[200px]" title={d.tenantDisputeNote}>
                        — &quot;{d.tenantDisputeNote}&quot;
                      </span>
                    )}
                  </div>
                  {d.evidencePhotos && d.evidencePhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {d.evidencePhotos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={photo.area}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.imageUrl}
                            alt={`Evidence photo for ${photo.area}`}
                            className="h-12 w-12 rounded-md border border-[rgba(196,154,60,0.2)] object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-sm font-semibold ${d.status === 'WITHDRAWN' ? 'text-white/30' : 'text-white'}`}>
                    {formatRM(d.amount)}
                  </span>
                  {canLandlordWithdrawDeduction(d.status) && canWithdrawDeductions && (
                    <button
                      onClick={() => withdrawDeduction(d.id)}
                      className="text-xs text-[#f87171]/60 hover:text-[#f87171]"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            ))}

            {activeDeductions.length > 0 && (
              <div className="flex justify-between pt-2 text-sm">
                <span className="text-white/50">Total deductions</span>
                <span className="font-semibold text-white">
                  {formatRM(activeDeductions.reduce((s, d) => s + d.amount, 0))}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Add deduction form */}
        {canAddDeductions && (
          <div className="border-t border-[rgba(196,154,60,0.1)] pt-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Add Deduction</p>
            <div className="space-y-3">
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason (e.g. damaged bedroom door, RM 350)"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Amount (RM)"
                  min="0"
                  step="0.01"
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
                />
                <button
                  onClick={addDeduction}
                  disabled={addingDeduction || !newReason.trim() || !newAmount}
                  className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] font-semibold px-4 py-2 rounded-lg text-sm"
                >
                  {addingDeduction ? '…' : '+ Add'}
                </button>
              </div>

              {/* Move-out photo references */}
              {moveOutPhotos.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 mb-1.5">Attach move-out photos as evidence (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {moveOutPhotos.map((photo) => (
                      <label key={photo.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedPhotos.includes(photo.id)}
                          onChange={(e) =>
                            setSelectedPhotos((prev) =>
                              e.target.checked ? [...prev, photo.id] : prev.filter((id) => id !== photo.id)
                            )
                          }
                        />
                        <div className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${selectedPhotos.includes(photo.id) ? 'border-[#C49A3C]' : 'border-[rgba(196,154,60,0.15)]'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.imageUrl} alt={photo.area} className="w-full h-full object-cover" />
                          {selectedPhotos.includes(photo.id) && (
                            <div className="absolute inset-0 bg-[#C49A3C]/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mark as paid */}
      {canMarkPaid && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-xl p-5">
          <p className="font-semibold text-[#4ade80] text-sm mb-1">All parties agreed — ready to pay</p>
          <p className="text-[#4ade80] text-xs mb-4">
            Refund {formatRM(refund.refundAmount)} to {tenantName} and upload proof of transfer.
          </p>
          <input
            ref={proofFileRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleProofUpload}
            className="hidden"
            id="proof-upload"
          />
          <label
            htmlFor="proof-upload"
            className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition-colors ${
              uploadingProof
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.25)] text-[#4ade80] hover:opacity-90'
            }`}
          >
            {uploadingProof ? 'Uploading…' : 'Upload Payment Proof & Mark Paid'}
          </label>
        </div>
      )}

      {/* Paid state */}
      {refund.status === 'PAID' && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-xl p-5 flex items-center gap-3">
          <svg className="w-6 h-6 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold text-[#4ade80] text-sm">Deposit refund paid</p>
            {refund.paidAt && (
              <p className="text-[#4ade80] text-xs mt-0.5">
                Paid on {new Date(refund.paidAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            {refund.paidProofUrl && (
              <a href={refund.paidProofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C49A3C] hover:underline">
                View proof ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Disputed state */}
      {refund.status === 'DISPUTED' && (
        <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-xl p-5">
          <p className="font-semibold text-[#f87171] text-sm">Dispute unresolved</p>
          <p className="text-[#f87171] text-xs mt-1 leading-relaxed">
            One or more deductions are disputed. Consider withdrawing the disputed deductions to reach agreement, or proceed to external mediation.
          </p>
        </div>
      )}

      {error && <p className="text-[#f87171] text-sm">{error}</p>}
    </div>
  );
}
