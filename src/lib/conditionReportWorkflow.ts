export const CONDITION_REPORT_LOCKED_STATUSES = [
  'ACCEPTED',
  'DISPUTED',
  'LOCKED',
] as const;

export const CONDITION_REPORT_INITIAL_REVIEW_STATUSES = [
  'SUBMITTED',
  'PENDING_REVIEW',
] as const;

export const CONDITION_REPORT_COUNTER_REVIEW_STATUS =
  'COUNTER_EVIDENCE_ADDED' as const;

export const ALL_CONDITION_REPORT_TYPES = [
  {
    value: 'MOVE_IN',
    label: 'Move-In Report',
    description: 'Document property condition at the start of tenancy',
  },
  {
    value: 'MOVE_OUT',
    label: 'Move-Out Report',
    description: 'Document property condition when tenant is leaving',
  },
  {
    value: 'INSPECTION',
    label: 'Mid-Tenancy Inspection',
    description: 'Periodic check on property condition during tenancy',
  },
] as const;

type ReviewInput = {
  status: string;
  createdById: string;
  reviewedById: string | null;
  currentUserId: string;
};

type ReviewRecipientInput = {
  creatorId: string;
  landlordId: string;
  tenantId: string;
};

export function isConditionReportLocked(status: string) {
  return CONDITION_REPORT_LOCKED_STATUSES.includes(
    status as (typeof CONDITION_REPORT_LOCKED_STATUSES)[number],
  );
}

export function getCounterEvidenceNextStatus() {
  return CONDITION_REPORT_COUNTER_REVIEW_STATUS;
}

export function getAvailableConditionReportTypes(tenancyStatus: string) {
  if (tenancyStatus === 'ACTIVE') return [...ALL_CONDITION_REPORT_TYPES];
  if (tenancyStatus === 'EXPIRED' || tenancyStatus === 'TERMINATED') {
    return ALL_CONDITION_REPORT_TYPES.filter((type) => type.value !== 'MOVE_IN');
  }
  return [];
}

export function getDefaultConditionReportType(tenancyStatus: string) {
  return getAvailableConditionReportTypes(tenancyStatus)[0]?.value ?? null;
}

export function getReviewNotificationRecipient({
  creatorId,
  landlordId,
  tenantId,
}: ReviewRecipientInput) {
  return creatorId === landlordId ? tenantId : landlordId;
}

export function canReviewConditionReport({
  status,
  createdById,
  reviewedById,
  currentUserId,
}: ReviewInput) {
  if (
    CONDITION_REPORT_INITIAL_REVIEW_STATUSES.includes(
      status as (typeof CONDITION_REPORT_INITIAL_REVIEW_STATUSES)[number],
    )
  ) {
    return createdById !== currentUserId;
  }

  if (status === CONDITION_REPORT_COUNTER_REVIEW_STATUS) {
    return reviewedById !== null && reviewedById !== currentUserId;
  }

  return false;
}
