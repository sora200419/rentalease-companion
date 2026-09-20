import Link from 'next/link';

type KycState = 'none' | 'PENDING' | 'REJECTED';

interface Props {
  role: string;
  kycState: KycState;
  rejectedReason?: string | null;
}

export default function KycPendingBanner({ role, kycState, rejectedReason }: Props) {
  if (kycState === 'PENDING') {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(196,154,60,0.2)] bg-[rgba(196,154,60,0.06)] px-4 py-3 text-sm text-[#C49A3C]">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#C49A3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-semibold">Identity verification under review</p>
          <p className="mt-0.5 text-xs text-[#C49A3C]">
            An admin is reviewing your submission. You&apos;ll be notified once approved.
          </p>
        </div>
      </div>
    );
  }

  if (kycState === 'REJECTED') {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#f87171]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1">
          <p className="font-semibold">Identity verification rejected</p>
          {rejectedReason && <p className="mt-0.5 text-xs text-[#f87171]">{rejectedReason}</p>}
          <Link href="/dashboard/kyc" className="mt-1 inline-block text-xs font-medium underline hover:opacity-80">
            Resubmit verification
          </Link>
        </div>
      </div>
    );
  }

  // kycState === 'none'
  const detail =
    role === 'LANDLORD'
      ? 'You cannot add properties or invite tenants until your identity is approved.'
      : 'You cannot accept tenancy invitations until your identity is approved.';

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.08)] px-4 py-3 text-sm text-[#E8B84B]">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#E8B84B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="flex-1">
        <p className="font-semibold">Identity verification required</p>
        <p className="mt-0.5 text-xs text-[#E8B84B] leading-relaxed">
          {detail}{' '}
          <Link href="/dashboard/kyc" className="font-medium underline hover:opacity-80">
            Verify your identity
          </Link>
        </p>
      </div>
    </div>
  );
}
