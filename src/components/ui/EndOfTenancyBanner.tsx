'use client';

import Link from 'next/link';
import { getDepositSettlementEntry } from '@/lib/depositSettlementWorkflow';

interface EndOfTenancyBannerProps {
  tenancyId: string;
  daysLeft: number;
  role: 'LANDLORD' | 'TENANT';
  hasMoveOutReport: boolean;
  acknowledgedMoveOut: boolean;
  depositRefundStatus: string | null;
}

export function EndOfTenancyBanner({
  tenancyId,
  daysLeft,
  role,
  hasMoveOutReport,
  acknowledgedMoveOut,
  depositRefundStatus,
}: EndOfTenancyBannerProps) {
  const urgency = daysLeft <= 7 ? 'red' : daysLeft <= 14 ? 'amber' : 'blue';
  const depositSettlementEntry = getDepositSettlementEntry({
    role,
    acknowledgedMoveOut,
    depositRefundStatus,
  });

  const colorClasses = {
    red: 'bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.25)] text-[#f87171]',
    amber: 'bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)] text-[#E8B84B]',
    blue: 'bg-[rgba(196,154,60,0.06)] border-[rgba(196,154,60,0.2)] text-[#C49A3C]',
  }[urgency];

  return (
    <div className={`border rounded-xl px-5 py-4 ${colorClasses}`}>
      <p className="font-bold text-sm mb-1">
        Tenancy ending in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
      </p>
      <p className="text-xs mb-3 opacity-80">
        Review your options below and prepare for the handover process.
      </p>

      {/* Action links */}
      <div className="flex flex-wrap gap-3">
        {role === 'LANDLORD' && (
          <>
            <Link
              href={`/dashboard/landlord/tenancies/${tenancyId}/renew`}
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-current rounded-lg px-3 py-1.5 transition-colors"
            >
              Renew Tenancy
            </Link>
            <Link
              href={`/dashboard/landlord/tenancies/${tenancyId}/terminate`}
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-current rounded-lg px-3 py-1.5 transition-colors"
            >
              End by Mutual Agreement
            </Link>
          </>
        )}

        {!hasMoveOutReport && (
          <Link
            href={
              role === 'LANDLORD'
                ? `/dashboard/landlord/tenancies/${tenancyId}/conditions`
                : `/dashboard/tenant/conditions`
            }
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-current rounded-lg px-3 py-1.5 transition-colors"
          >
            Create Move-Out Report
          </Link>
        )}

        {depositSettlementEntry && (
          <Link
            href={`/dashboard/landlord/tenancies/${tenancyId}/deposit-settlement`}
            title={depositSettlementEntry.description}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-current rounded-lg px-3 py-1.5 transition-colors"
          >
            {depositSettlementEntry.label}
          </Link>
        )}
      </div>
    </div>
  );
}
