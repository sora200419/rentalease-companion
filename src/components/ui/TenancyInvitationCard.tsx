'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
  propertyAddress: string;
  propertyCity: string;
  roomLabel: string;
  rentAmount: number;
  depositAmount: number;
  startDate: string;
  endDate: string;
  landlordName: string;
  landlordEmail: string;
}

export default function TenancyInvitationCard({
  tenancyId,
  propertyAddress,
  propertyCity,
  roomLabel,
  rentAmount,
  depositAmount,
  startDate,
  endDate,
  landlordName,
  landlordEmail,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responded, setResponded] = useState<'accepted' | 'declined' | null>(
    null,
  );

  const formatRM = (amount: number) =>
    `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const handleAction = async (action: 'accept' | 'decline') => {
    setIsLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setResponded(action === 'accept' ? 'accepted' : 'declined');
      setTimeout(() => router.refresh(), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  if (responded) {
    return (
      <div
        className={`rounded-xl border p-6 ${responded === 'accepted' ? 'bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.25)]' : 'bg-white/[0.03] border-[rgba(196,154,60,0.15)]'}`}
      >
        <p
          className={`font-semibold text-sm ${responded === 'accepted' ? 'text-[#4ade80]' : 'text-white/60'}`}
        >
          {responded === 'accepted'
            ? 'Invitation accepted — your landlord will now prepare the agreement.'
            : 'Invitation declined.'}
        </p>
        <p className="text-xs text-white/40 mt-1">Refreshing your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.2)] p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-bold text-white">{propertyAddress}</p>
          <p className="text-sm text-white/50 mt-0.5">
            {propertyCity} &mdash;{' '}
            <span className="font-medium">{roomLabel}</span>
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(196,154,60,0.1)] text-[#C49A3C] shrink-0">
          Invitation
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-white/40 text-xs">Monthly Rent</p>
          <p className="font-bold text-[#C49A3C] mt-0.5">
            {formatRM(rentAmount)}
          </p>
        </div>
        <div>
          <p className="text-white/40 text-xs">Security Deposit</p>
          <p className="font-semibold text-white mt-0.5">
            {formatRM(depositAmount)}
          </p>
        </div>
        <div>
          <p className="text-white/40 text-xs">Start Date</p>
          <p className="font-medium text-white mt-0.5">
            {formatDate(startDate)}
          </p>
        </div>
        <div>
          <p className="text-white/40 text-xs">End Date</p>
          <p className="font-medium text-white mt-0.5">
            {formatDate(endDate)}
          </p>
        </div>
      </div>

      <div className="bg-white/[0.03] rounded-lg px-4 py-3 mb-4">
        <p className="text-xs text-white/40 mb-1">Invited by</p>
        <p className="text-sm font-semibold text-white">{landlordName}</p>
        <p className="text-xs text-white/50">{landlordEmail}</p>
      </div>

      <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.1)] rounded-lg px-4 py-3 mb-4">
        <p className="text-xs text-[#C49A3C]">
          <strong>Accepting</strong> means the landlord can proceed to generate
          a tenancy agreement for your review. You can still request changes
          before signing. <strong>Declining</strong> cancels this invitation.
        </p>
      </div>

      {error && (
        <p className="text-[#f87171] text-xs bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleAction('decline')}
          disabled={!!isLoading}
          className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-50 text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          {isLoading === 'decline' ? 'Declining…' : 'Decline'}
        </button>
        <button
          onClick={() => handleAction('accept')}
          disabled={!!isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
        >
          {isLoading === 'accept' ? 'Accepting…' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  );
}
