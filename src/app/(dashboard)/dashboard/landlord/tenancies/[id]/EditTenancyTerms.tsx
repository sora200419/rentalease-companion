'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
  // Current values pre-fill the form so the landlord sees what's already
  // there and only needs to correct what's wrong — no retyping everything.
  currentStartDate: string; // ISO string from tenancy.startDate.toISOString()
  currentEndDate: string; // ISO string from tenancy.endDate.toISOString()
  currentMonthlyRent: number;
  currentDepositAmount: number;
  tenancyStatus: 'INVITED' | 'PENDING';
  leasePartyType: 'INDIVIDUAL' | 'CORPORATE';
  currentInvitationEmail: string;
}

export default function EditTenancyTerms({
  tenancyId,
  currentStartDate,
  currentEndDate,
  currentMonthlyRent,
  currentDepositAmount,
  tenancyStatus,
  leasePartyType,
  currentInvitationEmail,
}: Props) {
  const router = useRouter();

  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // HTML date inputs require YYYY-MM-DD — slice the ISO string to get that.
  // e.g. "2026-06-01T00:00:00.000Z" → "2026-06-01"
  const toDateInput = (iso: string) => iso.slice(0, 10);

  const [startDate, setStartDate] = useState(toDateInput(currentStartDate));
  const [endDate, setEndDate] = useState(toDateInput(currentEndDate));
  const [monthlyRent, setMonthlyRent] = useState(String(currentMonthlyRent));
  const [depositAmount, setDepositAmount] = useState(
    String(currentDepositAmount),
  );
  const [invitationEmail, setInvitationEmail] = useState(currentInvitationEmail);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic client-side date validation before hitting the network.
    // The API validates server-side too, but catching it here gives instant feedback.
    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after the start date.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          monthlyRent: Number(monthlyRent),
          depositAmount: Number(depositAmount),
          invitationEmail: invitationEmail.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update tenancy terms.');
        return;
      }

      setIsOpen(false);
      // router.refresh() triggers Next.js to re-run the server component,
      // so the updated values appear immediately without a full page reload.
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset form fields back to their original values when cancelling,
    // so stale edits don't persist if the landlord re-opens the form later.
    setStartDate(toDateInput(currentStartDate));
    setEndDate(toDateInput(currentEndDate));
    setMonthlyRent(String(currentMonthlyRent));
    setDepositAmount(String(currentDepositAmount));
    setInvitationEmail(currentInvitationEmail);
    setError(null);
    setIsOpen(false);
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';

  // ── Collapsed state: just a small link ────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-[#C49A3C] hover:text-[#E8B84B] hover:underline font-medium mt-3 inline-block"
      >
        Edit terms
      </button>
    );
  }

  // ── Expanded state: the edit form ─────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 pt-4 border-t border-[rgba(196,154,60,0.1)] space-y-4"
    >
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
        Edit Tenancy Terms
      </p>

      {/* Dates row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            min={today}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
      </div>

      {/* Rent and deposit row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Monthly Rent (RM)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            Security Deposit (RM)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className={inputClass}
            required
          />
          {/* Dynamic suggestion based on the current rent value.
              Malaysian norm is 2 months deposit for residential tenancies. */}
          {Number(monthlyRent) > 0 && (
            <p className="text-xs text-white/40 mt-1">
              Suggested: RM{' '}
              {(Number(monthlyRent) * 2).toLocaleString('en-MY', {
                minimumFractionDigits: 2,
              })}{' '}
              (2 months rent)
            </p>
          )}
        </div>
      </div>

      {tenancyStatus === 'INVITED' && (
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">
            {leasePartyType === 'CORPORATE'
              ? 'Authorized Signatory Email'
              : 'Invited Tenant Email'}
          </label>
          <input
            type="email"
            value={invitationEmail}
            onChange={(e) => setInvitationEmail(e.target.value)}
            className={inputClass}
            required
          />
          <p className="text-xs text-white/40 mt-1">
            {leasePartyType === 'CORPORATE'
              ? 'Use this if the legal invitation was sent to the wrong signatory. Saving will resend the invitation to the new tenant account.'
              : 'Use this if the invitation was sent to the wrong tenant. Saving will resend the invitation to the new tenant account.'}
          </p>
        </div>
      )}

      {/* Inline explanation of when editing is allowed */}
      <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-lg px-3 py-2.5">
        <p className="text-xs text-[#E8B84B]">
          {tenancyStatus === 'INVITED'
            ? 'While the invitation is still pending, you can correct the invited tenant or signatory and update the tenancy terms. Once the invite is accepted, the recipient can no longer be changed from here.'
            : 'Terms can be edited before an agreement is generated. Once you generate an agreement, dates and amounts are locked into the legal text.'}
        </p>
      </div>

      {/* Error display */}
      {error && (
        <p className="text-[#f87171] text-xs bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 text-sm font-medium text-white/50 border border-white/10 py-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 text-sm font-semibold text-[#1C2740] bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 py-2 rounded-lg transition-colors"
        >
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
