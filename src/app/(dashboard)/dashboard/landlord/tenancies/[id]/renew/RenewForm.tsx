'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
  currentEndDate: string;
  currentMonthlyRent: number;
  currentDepositAmount: number;
}

export default function RenewForm({ tenancyId, currentEndDate, currentMonthlyRent, currentDepositAmount }: Props) {
  const router = useRouter();

  // Default: new term starts day after current end, runs 12 months
  const defaultStart = new Date(currentEndDate);
  defaultStart.setDate(defaultStart.getDate() + 1);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);

  const toDateInput = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const minimumRenewalStart =
    toDateInput(defaultStart) > today ? toDateInput(defaultStart) : today;

  const [startDate, setStartDate] = useState(toDateInput(defaultStart));
  const [endDate, setEndDate] = useState(toDateInput(defaultEnd));
  const [monthlyRent, setMonthlyRent] = useState(String(currentMonthlyRent));
  const [depositAmount, setDepositAmount] = useState(String(currentDepositAmount));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (startDate < minimumRenewalStart) {
      setError('Renewal must start after the current tenancy end date.');
      setSubmitting(false);
      return;
    }
    if (endDate <= startDate) {
      setError('End date must be after the start date.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          monthlyRent: parseFloat(monthlyRent),
          depositAmount: parseFloat(depositAmount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to create renewal');
      }

      const data = await res.json();
      router.push(`/dashboard/landlord/tenancies/${data.tenancyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';
  const labelClass = 'block text-sm font-medium text-white/70 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>New Start Date</label>
          <input
            type="date"
            value={startDate}
            min={minimumRenewalStart}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>New End Date</label>
          <input
            type="date"
            value={endDate}
            min={minimumRenewalStart}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Monthly Rent (RM)</label>
          <input
            type="number"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            min="0"
            step="0.01"
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Security Deposit (RM)</label>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            min="0"
            step="0.01"
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 text-xs text-[#C49A3C]">
        A new tenancy invitation will be sent to the tenant. They must accept before you can draft a new agreement.
      </div>

      {error && <p className="text-[#f87171] text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? 'Creating renewal…' : 'Create Renewal Tenancy'}
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
