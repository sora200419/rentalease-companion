import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { AttentionHero, PageHeader, StatCard } from '@/components/ui/RedesignPrimitives';
import { getDashboardAttention } from '@/lib/uiRedesign';
import { getAdminVerificationHref } from '@/lib/kyc-workflow';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  const [totalUsers, pendingKycCount, totalProperties, unverifiedPropertiesCount] =
    await Promise.all([
      prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
      prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      prisma.property.count(),
      prisma.property.count({ where: { isVerified: false } }),
    ]);

  const attention = getDashboardAttention({
    role: 'ADMIN',
    pendingKyc: pendingKycCount,
    pendingProperties: unverifiedPropertiesCount,
  });
  const attentionHref = getAdminVerificationHref({ pendingKycSubmissions: pendingKycCount });

  return (
    <div>
      <PageHeader
        eyebrow="Admin verification center"
        title="Admin Dashboard"
        description="Review the queues that block platform activity and listing readiness."
      />

      <AttentionHero
        title={attention.title}
        description={attention.description}
        actionLabel={attention.actionLabel}
        href={attentionHref}
        secondary={
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C49A3C]">Blocking queues</p>
            <QueueLine label="Pending KYC" value={pendingKycCount} />
            <QueueLine label="Pending properties" value={unverifiedPropertiesCount} />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total users" value={totalUsers} />
        <StatCard label="Pending KYC" value={pendingKycCount} tone={pendingKycCount > 0 ? 'amber' : 'default'} />
        <StatCard label="Properties" value={totalProperties} tone="blue" />
        <StatCard
          label="Pending properties"
          value={unverifiedPropertiesCount}
          tone={unverifiedPropertiesCount > 0 ? 'amber' : 'default'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ReviewCard
          href="/dashboard/admin/kyc"
          title="KYC Verification Queue"
          description="Review pending KYC submissions and approve users."
          count={pendingKycCount}
        />
        <ReviewCard
          href="/dashboard/admin/properties"
          title="Property Verification Queue"
          description="Review and approve new property listings before tenants can be invited."
          count={unverifiedPropertiesCount}
        />
      </div>
    </div>
  );
}

function QueueLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#1C2740] px-3 py-2 text-sm">
      <span className="font-medium text-white/70">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${value > 0 ? 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740]' : 'bg-white/5 text-white/50'}`}>
        {value}
      </span>
    </div>
  );
}

function ReviewCard({
  href,
  title,
  description,
  count,
}: {
  href: string;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] px-5 py-4 transition-colors hover:border-white/10"
    >
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-white/50">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${count > 0 ? 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B] ring-1 ring-[rgba(251,191,36,0.25)] ring-inset' : 'bg-white/5 text-white/50'}`}>
          {count}
        </span>
        <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
