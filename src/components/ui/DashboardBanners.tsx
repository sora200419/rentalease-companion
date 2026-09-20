// src/components/ui/DashboardBanners.tsx
import Link from 'next/link';

interface BannerData {
  role: 'LANDLORD' | 'TENANT';
  pendingAgreementReviews?: number;
  rejectedPayments?: number;
  pendingChangesRequested?: number;
  pendingPaymentVerifications?: number;
  unacknowledgedConditionReports?: number;
}

type BannerColor = 'blue' | 'red' | 'amber';

interface Banner {
  text: string;
  href: string;
  color: BannerColor;
}

const COLOR_CLASSES: Record<BannerColor, { wrapper: string; icon: string }> = {
  blue:  { wrapper: 'bg-[rgba(196,154,60,0.06)] border-[rgba(196,154,60,0.2)] text-[#C49A3C]',   icon: 'text-[#C49A3C]' },
  red:   { wrapper: 'bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.25)] text-[#f87171]', icon: 'text-[#f87171]' },
  amber: { wrapper: 'bg-[rgba(251,191,36,0.08)] border-[rgba(251,191,36,0.25)] text-[#E8B84B]',  icon: 'text-[#E8B84B]' },
};

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BannerIcon({ color, className }: { color: BannerColor; className?: string }) {
  if (color === 'red') return <ErrorIcon className={className} />;
  if (color === 'amber') return <WarningIcon className={className} />;
  return <InfoIcon className={className} />;
}

export function DashboardBanners(props: BannerData) {
  const banners: Banner[] = [];

  if (props.role === 'TENANT') {
    if (props.pendingAgreementReviews && props.pendingAgreementReviews > 0) {
      banners.push({
        text: `${props.pendingAgreementReviews} agreement${props.pendingAgreementReviews > 1 ? 's' : ''} awaiting your review`,
        href: '/dashboard/tenant',
        color: 'blue',
      });
    }
    if (props.rejectedPayments && props.rejectedPayments > 0) {
      banners.push({
        text: `${props.rejectedPayments} payment proof${props.rejectedPayments > 1 ? 's' : ''} rejected — please re-upload`,
        href: '/dashboard/tenant',
        color: 'red',
      });
    }
  }

  if (props.role === 'LANDLORD') {
    if (props.pendingChangesRequested && props.pendingChangesRequested > 0) {
      banners.push({
        text: `${props.pendingChangesRequested} agreement${props.pendingChangesRequested > 1 ? 's' : ''} with tenant-requested changes`,
        href: '/dashboard/landlord',
        color: 'amber',
      });
    }
    if (props.pendingPaymentVerifications && props.pendingPaymentVerifications > 0) {
      banners.push({
        text: `${props.pendingPaymentVerifications} payment proof${props.pendingPaymentVerifications > 1 ? 's' : ''} awaiting verification`,
        href: '/dashboard/landlord',
        color: 'blue',
      });
    }
  }

  if (props.unacknowledgedConditionReports && props.unacknowledgedConditionReports > 0) {
    banners.push({
      text: `${props.unacknowledgedConditionReports} condition report${props.unacknowledgedConditionReports > 1 ? 's' : ''} awaiting your acknowledgement`,
      href: props.role === 'TENANT' ? '/dashboard/tenant' : '/dashboard/landlord',
      color: 'amber',
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {banners.map((b, i) => {
        const c = COLOR_CLASSES[b.color];
        return (
          <Link
            key={i}
            href={b.href}
            className={`flex items-start gap-3 border rounded-lg px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity ${c.wrapper}`}
          >
            <BannerIcon color={b.color} className={`w-4 h-4 mt-0.5 shrink-0 ${c.icon}`} />
            <span>{b.text}</span>
          </Link>
        );
      })}
    </div>
  );
}
