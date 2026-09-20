'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { submissionId: string; }

export default function AdminKycActions({ submissionId }: Props) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${submissionId}/approve`, { method: 'PATCH' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) { setError('Reason is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/kyc/${submissionId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setReason('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-[#f87171]">{error}</p>}
      {rejecting ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (required)"
            rows={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={() => { setRejecting(false); setReason(''); setError(null); }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5">
              Cancel
            </button>
            <button onClick={handleReject} disabled={loading}
              className="rounded-lg bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] px-4 py-2 text-sm font-semibold text-[#f87171] hover:opacity-90 disabled:opacity-50">
              {loading ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={handleApprove} disabled={loading}
            className="rounded-lg bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.25)] px-4 py-2 text-sm font-semibold text-[#4ade80] hover:opacity-90 disabled:opacity-50">
            {loading ? 'Approving…' : 'Approve'}
          </button>
          <button onClick={() => { setRejecting(true); setError(null); }} disabled={loading}
            className="rounded-lg border border-[rgba(248,113,113,0.25)] px-4 py-2 text-sm font-semibold text-[#f87171] hover:bg-[rgba(248,113,113,0.08)]">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
