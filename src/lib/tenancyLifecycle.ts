type RenewalPeriodInput = {
  currentEndDate: Date;
  startDate: Date;
  endDate: Date;
  today?: Date;
};

type TenancyActivationInput = {
  currentTenancyStatus: string;
  depositStatus?: string | null;
  agreementStatus?: string | null;
};

type MoveInConditionReportInput = {
  tenancyStatus: string;
  depositStatus?: string | null;
};

type RentPaymentLifecycleInput = {
  paymentStatus: string;
  dueDate: Date;
  tenancyStatus: string;
  terminatedAt?: Date | string | null;
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function validateRenewalPeriod({
  currentEndDate,
  startDate,
  endDate,
  today = new Date(),
}: RenewalPeriodInput) {
  if (dateOnly(startDate) < dateOnly(today)) {
    return 'Start date cannot be in the past';
  }

  if (endDate <= startDate) {
    return 'End date must be after start date';
  }

  if (dateOnly(startDate) <= dateOnly(currentEndDate)) {
    return 'Renewal must start after the current tenancy end date.';
  }

  return null;
}

export function validateImmediateTerminationDate(
  terminationDate: Date,
  now = new Date(),
) {
  if (terminationDate.getTime() > now.getTime()) {
    return 'Future termination dates are not supported. Use the termination action on the actual termination date.';
  }

  return null;
}

export function getTenancyStatusAfterAgreementSignatureApproval({
  currentTenancyStatus,
  depositStatus,
}: TenancyActivationInput) {
  if (currentTenancyStatus === 'TERMINATED' || currentTenancyStatus === 'EXPIRED') {
    return currentTenancyStatus;
  }

  return depositStatus === 'PAID' ? 'ACTIVE' : 'PENDING';
}

export function getTenancyStatusAfterDepositApproval({
  currentTenancyStatus,
  agreementStatus,
}: TenancyActivationInput) {
  if (currentTenancyStatus === 'TERMINATED' || currentTenancyStatus === 'EXPIRED') {
    return currentTenancyStatus;
  }

  return agreementStatus === 'SIGNED' ? 'ACTIVE' : 'PENDING';
}

export function canCreateMoveInConditionReport({
  tenancyStatus,
  depositStatus,
}: MoveInConditionReportInput) {
  return tenancyStatus === 'ACTIVE' && depositStatus === 'PAID';
}

export function getRentPaymentStatusForTenancyLifecycle({
  paymentStatus,
  dueDate,
  tenancyStatus,
  terminatedAt,
}: RentPaymentLifecycleInput) {
  if (
    tenancyStatus !== 'TERMINATED' ||
    !terminatedAt ||
    (paymentStatus !== 'PENDING' && paymentStatus !== 'LATE')
  ) {
    return paymentStatus;
  }

  const terminationDate =
    terminatedAt instanceof Date ? terminatedAt : new Date(terminatedAt);

  return dueDate.getTime() > terminationDate.getTime()
    ? 'WAIVED'
    : paymentStatus;
}
