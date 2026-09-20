'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
}

export default function TerminateForm({ tenancyId }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) { setError('Please check the confirmation box to proceed.'); return; }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          terminationDate: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to terminate tenancy');
      }

      router.push(`/dashboard/landlord/tenancies/${tenancyId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-white/70 mb-1">
          Reason for termination
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="State the grounds for termination (e.g. breach of tenancy terms, non-payment of rent, mutual agreement, sale of property)…"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
          required
          minLength={10}
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/10 text-[#f87171] focus:ring-[#f87171]"
        />
        <span className="text-sm text-white/70">
          I confirm that I have provided the required notice period as per the tenancy agreement and Malaysian tenancy law, and I understand this action is irreversible.
        </span>
      </label>

      {error && <p className="text-[#f87171] text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !confirmed}
          className="bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.25)] hover:opacity-90 disabled:opacity-50 text-[#f87171] font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Processing…' : 'Serve Notice & Terminate'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-white/10 text-white/70 font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
