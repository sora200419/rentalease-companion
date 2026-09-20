'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  userId: string;
  userName: string;
  isSuspended: boolean;
}

export default function SuspendButton({ userId, userName, isSuspended }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !isSuspended }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Something went wrong');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={isSuspended ? `Unsuspend ${userName}` : `Suspend ${userName}`}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
          isSuspended
            ? 'border-[rgba(74,222,128,0.25)] text-[#4ade80] hover:bg-[rgba(74,222,128,0.08)]'
            : 'border-[rgba(251,191,36,0.25)] text-[#E8B84B] hover:bg-[rgba(251,191,36,0.08)]'
        }`}
      >
        {loading ? '…' : isSuspended ? 'Unsuspend' : 'Suspend'}
      </button>
      {error && <p className="mt-1 text-xs text-[#f87171]">{error}</p>}
    </div>
  );
}
