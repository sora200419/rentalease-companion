import { prisma } from './prisma';

export function buildRentScheduleEntries(
  tenancyId: string,
  startDate: Date,
  endDate: Date,
  monthlyRent: unknown,
  rentDueDay?: number | null,
): {
  tenancyId: string;
  dueDate: Date;
  amount: number;
  status: 'PENDING';
}[] {
  const amount = Number(monthlyRent);
  const payments: {
    tenancyId: string;
    dueDate: Date;
    amount: number;
    status: 'PENDING';
  }[] = [];

  const resolvedRentDueDay = rentDueDay ?? startDate.getDate();

  function dueDateForMonth(year: number, month: number): Date {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(resolvedRentDueDay, daysInMonth));
  }

  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth();
  let firstDueDate = dueDateForMonth(currentYear, currentMonth);

  if (firstDueDate < startDate) {
    currentMonth += 1;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    firstDueDate = dueDateForMonth(currentYear, currentMonth);
  }

  let current = new Date(firstDueDate);
  while (current <= endDate) {
    payments.push({
      tenancyId,
      dueDate: new Date(current),
      amount,
      status: 'PENDING',
    });
    current = dueDateForMonth(current.getFullYear(), current.getMonth() + 1);
  }

  return payments;
}

// Creates the full monthly rent schedule when a tenancy goes ACTIVE.
// Called once when the agreement workflow fully completes.
export async function generateRentSchedule(
  tenancyId: string,
  startDate: Date,
  endDate: Date,
  monthlyRent: unknown,
  rentDueDay?: number | null,
): Promise<void> {
  const existingPayments = await prisma.rentPayment.count({
    where: { tenancyId },
  });
  if (existingPayments > 0) return;

  const payments = buildRentScheduleEntries(
    tenancyId,
    startDate,
    endDate,
    monthlyRent,
    rentDueDay,
  );
  if (payments.length === 0) return;
  await prisma.rentPayment.createMany({ data: payments });
}

// After a landlord approves a payment, find the next PENDING payment
// for the same tenancy and ensure it's visible and correctly staged.
export async function ensureNextPaymentPending(
  tenancyId: string,
  currentDueDate: Date,
): Promise<void> {
  const nextPayment = await prisma.rentPayment.findFirst({
    where: {
      tenancyId,
      dueDate: { gt: currentDueDate },
      // LATE is no longer written by the application — all legacy LATE rows
      // were migrated to PENDING in the Phase 10 migration. Only query PENDING.
      status: 'PENDING',
    },
    orderBy: { dueDate: 'asc' },
  });

  // Nothing to do if the next payment is already in the right state
  if (!nextPayment) return;
}
