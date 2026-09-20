import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PaymentProofUploader from '@/components/ui/PaymentProofUploader';
import DepositProofUploader from '@/components/ui/DepositProofUploader';
import { PageHeader } from '@/components/ui/RedesignPrimitives';
import {
  buildTenantPaymentsTenancyQuery,
  getTenantPaymentStats,
  getTenantRentPaymentDisplayStatus,
} from '@/lib/tenantPayments';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  PAID: 'Paid',
  LATE: 'Late',
  WAIVED: 'Waived',
};

const PILL_BASE =
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

const STATUS_STYLE: Record<string, string> = {
  PENDING: `${PILL_BASE} bg-white/8 text-white/50 ring-1 ring-[rgba(196,154,60,0.15)] ring-inset`,
  UNDER_REVIEW: `${PILL_BASE} bg-[rgba(196,154,60,0.12)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.3)] ring-inset`,
  PAID: `${PILL_BASE} bg-[rgba(74,222,128,0.12)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.3)] ring-inset`,
  LATE: `${PILL_BASE} bg-[rgba(248,113,113,0.12)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.3)] ring-inset`,
  WAIVED: `${PILL_BASE} bg-white/8 text-white/50 ring-1 ring-[rgba(196,154,60,0.15)] ring-inset`,
};

export default async function TenantPaymentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'TENANT') redirect('/login');

  const tenancies = await prisma.tenancy.findMany(
    buildTenantPaymentsTenancyQuery(session.user.id),
  );

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatRM = (amount: unknown) =>
    `RM ${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const today = new Date();
  const overallStats = getTenantPaymentStats(tenancies);

  return (
    <div>
      <PageHeader
        eyebrow="My payments"
        title="Payments"
        description="Track your rent and deposit payments across all your tenancies."
      />

      {tenancies.length === 0 && (
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-12 text-center">
          <p className="text-white/70 font-semibold">No tenancy found</p>
          <p className="text-sm text-white/40 mt-1">
            Payment tracking will be available once your landlord links you to a
            tenancy.
          </p>
        </div>
      )}

      {tenancies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatBox label="Total" value={overallStats.total} color="text-white" />
          <StatBox
            label="Paid"
            value={overallStats.paid}
            color="text-[#4ade80]"
          />
          <StatBox
            label="Pending"
            value={overallStats.pending}
            color="text-[#facc15]"
          />
          <StatBox
            label="Under Review"
            value={overallStats.underReview}
            color="text-[#C49A3C]"
          />
        </div>
      )}

      <div className="space-y-8">
        {tenancies.map((tenancy) => {
          const tenancyStats = getTenantPaymentStats([tenancy]);
          const propertyLabel = `${tenancy.room.property.address}, ${tenancy.room.property.city}`;

          return (
            <section
              key={tenancy.id}
              className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#111827]/40 p-4 sm:p-5"
            >
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {propertyLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    Room: {tenancy.room.label} | Tenancy period:{' '}
                    {formatDate(tenancy.startDate)} to{' '}
                    {formatDate(tenancy.endDate)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold text-white/50">
                  {tenancy.status.charAt(0) + tenancy.status.slice(1).toLowerCase()}
                </span>
              </div>

              <div
                className={`bg-[#1C2740] rounded-xl border p-5 mb-6 ${
                  tenancy.depositStatus === 'UNDER_REVIEW'
                    ? 'border-[rgba(251,191,36,0.25)]'
                    : tenancy.depositStatus === 'PAID'
                      ? 'border-[rgba(74,222,128,0.3)]'
                      : tenancy.depositStatus === 'REJECTED'
                        ? 'border-[rgba(248,113,113,0.3)]'
                        : 'border-[rgba(196,154,60,0.15)]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Security Deposit
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {formatRM(tenancy.depositAmount)} | one-time payment
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      tenancy.depositStatus === 'PAID'
                        ? 'bg-[rgba(74,222,128,0.12)] text-[#4ade80]'
                        : tenancy.depositStatus === 'UNDER_REVIEW'
                          ? 'bg-[rgba(251,191,36,0.08)] text-[#facc15]'
                          : tenancy.depositStatus === 'REJECTED'
                            ? 'bg-[rgba(248,113,113,0.12)] text-[#f87171]'
                            : 'bg-white/8 text-white/50'
                    }`}
                  >
                    {tenancy.depositStatus === 'UNDER_REVIEW'
                      ? 'Under Review'
                      : tenancy.depositStatus === 'PAID'
                        ? 'Confirmed'
                        : tenancy.depositStatus === 'REJECTED'
                          ? 'Rejected'
                          : 'Pending'}
                  </span>
                </div>
                <DepositProofUploader
                  tenancyId={tenancy.id}
                  depositStatus={tenancy.depositStatus}
                  depositRejectionReason={tenancy.depositRejectionReason}
                  existingProofs={tenancy.depositProofs}
                  depositAmount={formatRM(tenancy.depositAmount)}
                />
              </div>

              {tenancy.rentPayments.length === 0 ? (
                <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-8 text-center">
                  <p className="text-white/70 font-semibold">
                    No rent schedule yet
                  </p>
                  <p className="text-sm text-white/40 mt-1">
                    Your monthly payment schedule will appear here once your
                    agreement is signed and the deposit is confirmed.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <StatBox
                      label="Tenancy Total"
                      value={tenancyStats.total}
                      color="text-white"
                    />
                    <StatBox
                      label="Paid"
                      value={tenancyStats.paid}
                      color="text-[#4ade80]"
                    />
                    <StatBox
                      label="Pending"
                      value={tenancyStats.pending}
                      color="text-[#facc15]"
                    />
                    <StatBox
                      label="Under Review"
                      value={tenancyStats.underReview}
                      color="text-[#C49A3C]"
                    />
                  </div>

                  <div className="space-y-4">
                    {tenancy.rentPayments.map((payment) => {
                      const displayStatus = getTenantRentPaymentDisplayStatus(
                        tenancy,
                        payment,
                      );
                      const isOverdue =
                        displayStatus === 'PENDING' &&
                        new Date(payment.dueDate) < today;

                      return (
                        <div
                          key={payment.id}
                          className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {formatDate(payment.dueDate)}
                              </p>
                              <p className="text-xs text-white/40">
                                {formatRM(payment.amount)}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                isOverdue
                                  ? 'bg-[rgba(248,113,113,0.12)] text-[#f87171]'
                                  : (STATUS_STYLE[displayStatus] ??
                                    'bg-white/8 text-white/50')
                              }`}
                            >
                              {isOverdue
                                ? 'Overdue'
                                : (STATUS_LABEL[displayStatus] ??
                                  displayStatus)}
                            </span>
                          </div>

                          <PaymentProofUploader
                            paymentId={payment.id}
                            currentStatus={displayStatus}
                            rejectionReason={payment.rejectionReason}
                            existingProofs={payment.proofs.map((proof) => ({
                              id: proof.id,
                              imageUrl: proof.imageUrl,
                            }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}
