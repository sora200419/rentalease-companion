import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import PaymentVerificationCard from '@/components/ui/PaymentVerficationCard';
import DepositVerificationCard from '@/components/ui/DepositVerificationCard';
import { PageHeader, StatCard, SectionCard } from '@/components/ui/RedesignPrimitives';
import { getRentPaymentStatusForTenancyLifecycle } from '@/lib/tenancyLifecycle';

export default async function LandlordPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  const [allPayments, allDepositTenancies] = await Promise.all([
    prisma.rentPayment.findMany({
      where: {
        tenancy: { room: { property: { landlordId: session.user.id } } },
      },
      include: {
        proofs: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, imageUrl: true, createdAt: true },
        },
        tenancy: {
          include: {
            room: {
              include: {
                property: { select: { address: true, city: true } },
              },
            },
            tenant: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    }),

    // Fetch tenancies where tenant has acted on deposit (not PENDING)
    prisma.tenancy.findMany({
      where: {
        room: { property: { landlordId: session.user.id } },
        status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
        NOT: { depositStatus: 'PENDING' },
      },
      include: {
        depositProofs: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, imageUrl: true, createdAt: true },
        },
        room: {
          include: {
            property: { select: { address: true, city: true } },
          },
        },
        tenant: { select: { name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatRM = (amount: unknown) =>
    `RM ${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const today = new Date();
  const getPaymentDisplayStatus = (payment: (typeof allPayments)[number]) =>
    getRentPaymentStatusForTenancyLifecycle({
      paymentStatus: payment.status,
      dueDate: payment.dueDate,
      tenancyStatus: payment.tenancy.status,
      terminatedAt: payment.tenancy.terminatedAt,
    });

  const underReview = allPayments.filter((p) => p.status === 'UNDER_REVIEW');
  const pending = allPayments.filter(
    (p) => {
      const status = getPaymentDisplayStatus(p);
      return status === 'PENDING' || status === 'LATE';
    },
  );
  const paid = allPayments.filter(
    (p) => {
      const status = getPaymentDisplayStatus(p);
      return status === 'PAID' || status === 'WAIVED';
    },
  );
  const overdue = pending.filter((p) => new Date(p.dueDate) < today);

  const depositsUnderReview = allDepositTenancies.filter(
    (t) => t.depositStatus === 'UNDER_REVIEW',
  );
  const depositsConfirmed = allDepositTenancies.filter(
    (t) => t.depositStatus === 'PAID',
  );
  const depositsRejected = allDepositTenancies.filter(
    (t) => t.depositStatus === 'REJECTED',
  );

  const totalAwaiting = underReview.length + depositsUnderReview.length;

  return (
    <div>
      <PageHeader
        eyebrow="Payment ledger"
        title="Payments"
        description="Review rent and deposit proof across all active and pending tenancies."
        action={totalAwaiting > 0
          ? <span className="rounded-full bg-[rgba(251,191,36,0.2)] px-2.5 py-1 text-xs font-bold text-[#facc15]">{totalAwaiting} awaiting review</span>
          : undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Rent total" value={allPayments.length} />
        <StatCard label="Under review" value={underReview.length} tone="amber" />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length > 0 ? 'red' : 'default'} />
        <StatCard label="Confirmed" value={paid.length} tone="green" />
      </div>

      {/* ── Security Deposits ────────────────────────────────────────────────── */}
      {allDepositTenancies.length > 0 && (
          <SectionCard title="Security Deposits" className="mb-8">
            <div className="space-y-4">
              {/* Under review — approve/reject */}
              {depositsUnderReview.map((t) => (
                <DepositRow
                  key={t.id}
                  tenancy={t}
                  formatRM={formatRM}
                >
                  <DepositVerificationCard
                    tenancyId={t.id}
                    depositAmount={formatRM(t.depositAmount)}
                    depositStatus={t.depositStatus}
                    proofs={t.depositProofs}
                    rejectionReason={t.depositRejectionReason}
                  />
                </DepositRow>
              ))}

              {/* Rejected — waiting for tenant re-upload */}
              {depositsRejected.map((t) => (
                <DepositRow
                  key={t.id}
                  tenancy={t}
                  formatRM={formatRM}
                >
                  <div className="mt-4 border-t border-[rgba(196,154,60,0.12)] pt-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(248,113,113,0.12)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.3)] ring-inset">
                      Rejected — awaiting re-upload from tenant
                    </span>
                    {t.depositRejectionReason && (
                      <p className="text-xs text-white/40 mt-1.5">
                        Reason: {t.depositRejectionReason}
                      </p>
                    )}
                  </div>
                </DepositRow>
              ))}

              {/* Confirmed */}
              {depositsConfirmed.map((t) => (
                <DepositRow
                  key={t.id}
                  tenancy={t}
                  formatRM={formatRM}
                >
                  <div className="mt-4 border-t border-[rgba(196,154,60,0.12)] pt-4 flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(74,222,128,0.12)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.3)] ring-inset">
                      Confirmed
                    </span>
                    {t.depositProofs.length > 0 && (
                      <a
                        href={t.depositProofs[0].imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C49A3C] hover:underline"
                      >
                        View proof
                      </a>
                    )}
                  </div>
                </DepositRow>
              ))}
            </div>
          </SectionCard>
      )}

      {allPayments.length === 0 && allDepositTenancies.length === 0 && (
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-12 text-center">
          <p className="text-white/70 font-semibold">No payments yet</p>
          <p className="text-sm text-white/40 mt-1">
            Payment schedules are generated when tenants sign their agreements.
          </p>
        </div>
      )}

      {/* ── Rent: Awaiting Review ────────────────────────────────────────────── */}
      {underReview.length > 0 && (
          <SectionCard title="Rent — Awaiting Review" className="mb-8">
            <div className="space-y-4">
              {underReview.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  formatRM={formatRM}
                >
                  <PaymentVerificationCard
                    paymentId={payment.id}
                    dueDate={formatDate(payment.dueDate)}
                    amount={formatRM(payment.amount)}
                    status={payment.status}
                    proofs={payment.proofs}
                  />
                </PaymentRow>
              ))}
            </div>
          </SectionCard>
      )}

      {/* ── Rent: Pending / Overdue ──────────────────────────────────────────── */}
      {pending.length > 0 && (
          <SectionCard title="Rent — Pending" className="mb-8">
            <div className="space-y-4">
              {pending.map((payment) => {
                const isOverdue = new Date(payment.dueDate) < today;
                return (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    formatRM={formatRM}
                  >
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                          isOverdue
                            ? 'bg-[rgba(248,113,113,0.12)] text-[#f87171] ring-[rgba(248,113,113,0.3)]'
                            : 'bg-white/8 text-white/50 ring-[rgba(196,154,60,0.15)]'
                        }`}
                      >
                        {isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                      <span className="text-xs text-white/40 ml-2">
                        Due {formatDate(payment.dueDate)}
                      </span>
                    </div>
                  </PaymentRow>
                );
              })}
            </div>
          </SectionCard>
      )}

      {/* ── Rent: Paid ──────────────────────────────────────────────────────── */}
      {paid.length > 0 && (
          <SectionCard title="Rent — Paid / Waived" className="mb-8">
            <div className="space-y-4">
              {paid.map((payment) => {
                const displayStatus = getPaymentDisplayStatus(payment);
                return (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    formatRM={formatRM}
                  >
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[rgba(74,222,128,0.12)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.3)] ring-inset">
                        {displayStatus === 'WAIVED' ? 'Waived' : 'Paid'}
                      </span>
                      <span className="text-xs text-white/40">
                        Due {formatDate(payment.dueDate)}
                      </span>
                      {payment.proofs.length > 0 && (
                        <a
                          href={payment.proofs[0].imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#C49A3C] hover:underline"
                        >
                          View proof
                        </a>
                      )}
                    </div>
                  </PaymentRow>
                );
              })}
            </div>
          </SectionCard>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type PaymentWithRelations = {
  id: string;
  dueDate: Date;
  amount: unknown;
  status: string;
  proofs: { id: string; imageUrl: string; createdAt: Date }[];
  tenancy: {
    id: string;
    room: {
      label: string;
      property: { address: string; city: string };
    };
    tenant: { name: string; email: string };
  };
};

function PaymentRow({
  payment,
  formatRM,
  children,
}: {
  payment: PaymentWithRelations;
  formatRM: (a: unknown) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {payment.tenancy.room.property.address},{' '}
            {payment.tenancy.room.property.city}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Room: {payment.tenancy.room.label} · Tenant:{' '}
            {payment.tenancy.tenant.name} · {formatRM(payment.amount)}
          </p>
        </div>
        <Link
          href={`/dashboard/landlord/tenancies/${payment.tenancy.id}`}
          className="text-xs text-[#C49A3C] hover:underline flex-shrink-0 ml-4"
        >
          View tenancy →
        </Link>
      </div>
      {children}
    </div>
  );
}

type DepositTenancy = {
  id: string;
  depositAmount: unknown;
  depositStatus: string;
  depositRejectionReason: string | null;
  depositProofs: { id: string; imageUrl: string; createdAt: Date }[];
  room: {
    label: string;
    property: { address: string; city: string };
  };
  tenant: { name: string; email: string };
};

function DepositRow({
  tenancy,
  formatRM,
  children,
}: {
  tenancy: DepositTenancy;
  formatRM: (a: unknown) => string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {tenancy.room.property.address}, {tenancy.room.property.city}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            Room: {tenancy.room.label} · Tenant: {tenancy.tenant.name} ·{' '}
            {formatRM(tenancy.depositAmount)}
          </p>
        </div>
        <Link
          href={`/dashboard/landlord/tenancies/${tenancy.id}`}
          className="text-xs text-[#C49A3C] hover:underline flex-shrink-0 ml-4"
        >
          View tenancy →
        </Link>
      </div>
      {children}
    </div>
  );
}
