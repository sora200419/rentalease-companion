'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
}

export default function TenantWithdrawButton({ tenancyId }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/withdraw`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="border border-[rgba(248,113,113,0.25)] text-[#f87171] hover:bg-[rgba(248,113,113,0.08)] font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
      >
        Withdraw from Tenancy
      </button>
    );
  }

  return (
    <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-xl p-5">
      <p className="text-[#f87171] font-semibold text-sm mb-1">
        Confirm withdrawal
      </p>
      <p className="text-[#f87171] text-xs mb-4">
        This will cancel your pending tenancy and free the room. Any draft agreement
        will be deleted. This cannot be undone.
      </p>
      {error && <p className="text-[#f87171] text-sm mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={isLoading}
          className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          Back
        </button>
        <button
          onClick={withdraw}
          disabled={isLoading}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {isLoading ? 'Withdrawing…' : 'Confirm Withdraw'}
        </button>
      </div>
    </div>
  );
}
