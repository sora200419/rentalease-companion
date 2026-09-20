'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  propertyId: string;
}

type State = 'idle' | 'rejecting' | 'verified' | 'rejected';

export default function VerifyPropertyButton({ propertyId }: Props) {
  const [state, setState] = useState<State>('idle');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/verify`, { method: 'PATCH' });
      if (res.ok) {
        setState('verified');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        setState('rejected');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (state === 'verified') {
    return (
      <span className="text-[#4ade80] text-sm font-semibold bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.25)] px-3 py-1.5 rounded-lg">
        Verified
      </span>
    );
  }

  if (state === 'rejected') {
    return (
      <span className="text-[#f87171] text-sm font-semibold bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] px-3 py-1.5 rounded-lg">
        Rejected
      </span>
    );
  }

  if (state === 'rejecting') {
    return (
      <div className="flex flex-col gap-2 w-48">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-[rgba(248,113,113,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
        />
        <div className="flex gap-1.5">
          <button
            onClick={handleReject}
            disabled={loading || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
          >
            {loading ? 'Rejecting…' : 'Confirm'}
          </button>
          <button
            onClick={() => { setState('idle'); setReason(''); }}
            disabled={loading}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 text-xs font-semibold py-1.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleVerify}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
      >
        Verify
      </button>
      <button
        onClick={() => setState('rejecting')}
        disabled={loading}
        className="border border-[rgba(248,113,113,0.25)] hover:bg-[rgba(248,113,113,0.08)] text-[#f87171] text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
      >
        Reject
      </button>
    </div>
  );
}
