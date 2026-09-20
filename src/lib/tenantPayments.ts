import { getRentPaymentStatusForTenancyLifecycle } from './tenancyLifecycle';

export const PAYMENT_VISIBLE_TENANCY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;

type PaymentLike = {
  status: string;
  dueDate?: Date | string;
};

type TenancyPaymentsLike = {
  status?: string;
  terminatedAt?: Date | string | null;
  rentPayments: PaymentLike[];
};

export function getTenantRentPaymentDisplayStatus(
  tenancy: TenancyPaymentsLike,
  payment: PaymentLike,
) {
  if (!payment.dueDate || !tenancy.status) return payment.status;

  return getRentPaymentStatusForTenancyLifecycle({
    paymentStatus: payment.status,
    dueDate:
      payment.dueDate instanceof Date ? payment.dueDate : new Date(payment.dueDate),
    tenancyStatus: tenancy.status,
    terminatedAt: tenancy.terminatedAt,
  });
}

export function buildTenantPaymentsTenancyQuery(tenantId: string) {
  return {
    where: {
      tenantId,
      status: { in: [...PAYMENT_VISIBLE_TENANCY_STATUSES] },
    },
    orderBy: { createdAt: 'desc' as const },
    include: {
      room: {
        include: {
          property: { select: { address: true, city: true } },
        },
      },
      rentPayments: {
        orderBy: { dueDate: 'asc' as const },
        include: {
          proofs: {
            orderBy: { createdAt: 'desc' as const },
            select: { id: true, imageUrl: true },
          },
        },
      },
      depositProofs: {
        orderBy: { createdAt: 'desc' as const },
        select: { id: true, imageUrl: true },
      },
    },
  };
}

export function getTenantPaymentStats(tenancies: TenancyPaymentsLike[]) {
  const payments = tenancies.flatMap((tenancy) =>
    tenancy.rentPayments.map((payment) =>
      getTenantRentPaymentDisplayStatus(tenancy, payment),
    ),
  );

  return {
    total: payments.length,
    paid: payments.filter((status) => status === 'PAID' || status === 'WAIVED')
      .length,
    pending: payments.filter(
      (status) => status === 'PENDING' || status === 'LATE',
    ).length,
    underReview: payments.filter((status) => status === 'UNDER_REVIEW').length,
  };
}
