// src/app/(dashboard)/dashboard/tenant/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { DashboardBanners } from '@/components/ui/DashboardBanners';
import PropertyCover from '@/components/ui/PropertyCover';
import { AttentionHero, PageHeader, SectionCard, StatCard } from '@/components/ui/RedesignPrimitives';
import { triggerEndingSoonNotifications } from '@/lib/endingSoonNotifications';
import { getDashboardAttention, getPropertyCover } from '@/lib/uiRedesign';

export default async function TenantDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect('/login');
  if (session.user.role !== 'TENANT') redirect('/dashboard/landlord');

  const tenantId = session.user.id;

  void triggerEndingSoonNotifications(tenantId, 'TENANT');

  const [
    tenancies,
    pendingAgreementReviews,
    rejectedPayments,
    unacknowledgedConditionReports,
  ] = await Promise.all([
    prisma.tenancy.findMany({
      where: { tenantId },
      include: {
        room: {
          include: {
            property: {
              include: {
                photos: {
                  select: { imageUrl: true, caption: true, order: true, createdAt: true },
                  orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                },
                landlord: {
                  select: { id: true, name: true, email: true, phone: true },
                },
              },
            },
          },
        },
        agreement: { select: { id: true, status: true } },
        rentPayments: {
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            dueDate: true,
            amount: true,
            status: true,
            rejectionReason: true,
            proofs: { select: { id: true, imageUrl: true, createdAt: true } },
          },
        },
        conditionReports: {
          select: { id: true, type: true, acknowledgedAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.agreement.count({ where: { status: 'FINALIZED', tenancy: { tenantId } } }),
    prisma.rentPayment.count({
      where: { status: 'PENDING', rejectionReason: { not: null }, tenancy: { tenantId } },
    }),
    prisma.conditionReport.count({
      where: { acknowledgedAt: null, tenancy: { tenantId }, createdBy: { role: 'LANDLORD' } },
    }),
  ]);

  const activeTenancies = tenancies.filter((t) => t.status === 'ACTIVE');
  const pendingTenancies = tenancies.filter((t) => ['INVITED', 'PENDING'].includes(t.status));

  const nextPayment = activeTenancies
    .flatMap((t) => t.rentPayments)
    .filter((p) => p.status === 'PENDING')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const attention = getDashboardAttention({
    role: 'TENANT',
    pendingPaymentVerifications: rejectedPayments,
    pendingAgreementReviews,
    unacknowledgedConditionReports,
  });
  const primaryTenantHref =
    pendingAgreementReviews > 0
      ? '/dashboard/tenant/tenancy'
      : rejectedPayments > 0
      ? '/dashboard/tenant/payments'
      : unacknowledgedConditionReports > 0
      ? '/dashboard/tenant/conditions'
      : '/dashboard/tenant/tenancy';
  const pendingActions =
    pendingTenancies.length + pendingAgreementReviews + rejectedPayments + unacknowledgedConditionReports;

  return (
    <div>
      <PageHeader
        eyebrow="Tenant command center"
        title={`Welcome back, ${session.user.name}`}
        description="Track your home, agreement, rent payments, and required responses."
      />

      <DashboardBanners
        role="TENANT"
        pendingAgreementReviews={pendingAgreementReviews}
        rejectedPayments={rejectedPayments}
        unacknowledgedConditionReports={unacknowledgedConditionReports}
      />

      <AttentionHero
        title={attention.title}
        description={attention.description}
        actionLabel={attention.actionLabel}
        href={primaryTenantHref}
        secondary={
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#C49A3C]">Current queue</p>
            <QueueMetric label="Pending invitations" value={pendingTenancies.length} />
            <QueueMetric label="Agreement reviews" value={pendingAgreementReviews} />
            <QueueMetric label="Payment follow-ups" value={rejectedPayments} />
            <QueueMetric label="Condition reports" value={unacknowledgedConditionReports} />
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Active tenancies" value={activeTenancies.length} tone="blue" />
        <StatCard label="Pending actions" value={pendingActions} tone={pendingActions > 0 ? 'amber' : 'default'} />
        <StatCard
          label="Next payment"
          value={
            nextPayment
              ? `RM ${Number(nextPayment.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`
              : '-'
          }
          detail={nextPayment ? `Due ${new Date(nextPayment.dueDate).toLocaleDateString('en-MY')}` : 'No rent due'}
          tone={nextPayment ? 'green' : 'default'}
        />
      </div>

      {pendingTenancies.length > 0 && (
        <div className="mb-8">
          <SectionCard title="Pending invitations">
            <div className="divide-y divide-[rgba(255,255,255,0.05)]">
              {pendingTenancies.map((tenancy) => (
                <div key={tenancy.id} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">{tenancy.room.property.address}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {tenancy.room.property.city} &middot; {tenancy.room.label} &middot; Landlord: {tenancy.room.property.landlord.name}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-[rgba(250,204,21,0.12)] px-2.5 py-0.5 text-xs font-medium text-[#facc15] border border-[rgba(250,204,21,0.3)]">
                      {tenancy.status}
                    </span>
                    <Link href="/dashboard/tenant/tenancy" className="text-xs text-[#C49A3C] hover:text-[#E8B84B]">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTenancies.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-white">Active tenancies</h2>
          <div className="space-y-4">
            {activeTenancies.map((tenancy) => (
              <ActiveTenancyCard key={tenancy.id} tenancy={tenancy} />
            ))}
          </div>
        </section>
      ) : (
        tenancies.length === 0 && (
          <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-12 text-center">
            <p className="text-sm text-white/40">
              You don&apos;t have any tenancies yet. Your landlord will send you an invitation when they list a room for you.
            </p>
          </div>
        )
      )}
    </div>
  );
}

const PILL_BASE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

const AGREEMENT_PILL: Record<string, string> = {
  DRAFT: `${PILL_BASE} bg-white/5 text-white/30 border border-white/10`,
  FINALIZED: `${PILL_BASE} bg-[rgba(74,222,128,0.12)] text-[#4ade80] border border-[rgba(74,222,128,0.3)]`,
  NEGOTIATING: `${PILL_BASE} bg-[rgba(196,154,60,0.12)] text-[#C49A3C] border border-[rgba(196,154,60,0.3)]`,
  PENDING_TENANT: `${PILL_BASE} bg-[rgba(250,204,21,0.12)] text-[#facc15] border border-[rgba(250,204,21,0.3)]`,
};

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="font-medium text-white/70">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          value > 0 ? 'bg-[#C49A3C] text-[#1C2740]' : 'bg-white/10 text-white/30'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ActiveTenancyCard({ tenancy }: { tenancy: ActiveTenancyType }) {
  const agreementStatus = tenancy.agreement?.status;
  const cover = getPropertyCover(tenancy.room.property.photos ?? []);

  const nextPayment = tenancy.rentPayments
    .filter((p) => p.status === 'PENDING')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const hasRejectedPayment = tenancy.rentPayments.some(
    (p) => p.status === 'PENDING' && p.rejectionReason,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-4">
      <div className="grid gap-5 sm:grid-cols-[13rem_1fr]">
        <PropertyCover
          address={tenancy.room.property.address}
          imageUrl={cover?.imageUrl}
          caption={cover?.caption}
          className="rounded-xl"
          heightClassName="h-36 sm:h-full"
        />
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{tenancy.room.property.address}</p>
              <p className="mt-0.5 text-sm text-white/50">
                {tenancy.room.property.city} &middot; {tenancy.room.label}
              </p>
              <p className="mt-0.5 text-xs text-white/30">
                Landlord: {tenancy.room.property.landlord.name}
              </p>
            </div>
            <Link href="/dashboard/tenant/tenancy" className="shrink-0 text-sm text-[#C49A3C] hover:text-[#E8B84B]">
              View details &rarr;
            </Link>
          </div>

          {agreementStatus && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-white/40">Agreement:</span>
              <span className={AGREEMENT_PILL[agreementStatus] ?? `${PILL_BASE} bg-white/5 text-white/30`}>
                {agreementStatus.replace('_', ' ')}
              </span>
              {agreementStatus === 'FINALIZED' && (
                <Link href="/dashboard/tenant/tenancy" className="text-xs font-medium text-[#C49A3C] hover:text-[#E8B84B]">
                  Review &amp; sign &rarr;
                </Link>
              )}
            </div>
          )}

          {nextPayment && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-white/40">Next payment:</span>
              <span className="text-xs font-medium text-white">
                RM {Number(nextPayment.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-white/30">
                due {new Date(nextPayment.dueDate).toLocaleDateString('en-MY')}
              </span>
              {hasRejectedPayment && (
                <span className="inline-flex items-center rounded-full bg-[rgba(248,113,113,0.12)] px-2.5 py-0.5 text-xs font-medium text-[#f87171] border border-[rgba(248,113,113,0.3)]">
                  Proof rejected
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ActiveTenancyType = {
  id: string;
  status: string;
  room: {
    label: string;
    property: {
      address: string;
      city: string;
      photos: { imageUrl: string; caption: string | null; order: number | null; createdAt: Date }[];
      landlord: { id: string; name: string; email: string; phone: string | null };
    };
  };
  agreement: { id: string; status: string } | null;
  rentPayments: {
    id: string;
    dueDate: Date;
    amount: unknown;
    status: string;
    rejectionReason: string | null;
    proofs: { id: string; imageUrl: string; createdAt: Date }[];
  }[];
  conditionReports: { id: string; type: string; acknowledgedAt: Date | null; createdAt: Date }[];
};
