'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  revokeUrl: string;
}

type State = 'idle' | 'revoking' | 'revoked';

export default function RevokeButton({ revokeUrl }: Props) {
  const [state, setState] = useState<State>('idle');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRevoke = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(revokeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        setState('revoked');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  if (state === 'revoked') {
    return (
      <span className="text-[#E8B84B] text-sm font-semibold bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] px-3 py-1.5 rounded-lg">
        Revoked
      </span>
    );
  }

  if (state === 'revoking') {
    return (
      <div className="flex flex-col gap-2 w-48">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for revocation…"
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
        />
        <div className="flex gap-1.5">
          <button
            onClick={handleRevoke}
            disabled={loading || !reason.trim()}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
          >
            {loading ? 'Revoking…' : 'Confirm'}
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
    <button
      onClick={() => setState('revoking')}
      className="border border-[rgba(251,191,36,0.25)] hover:bg-[rgba(251,191,36,0.08)] text-[#E8B84B] text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
    >
      Revoke
    </button>
  );
}
