type DeductionWithStoredPhotoIds = {
  photoIds?: string | null;
};

export type DepositDeductionWorkflowStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'DISPUTED'
  | 'WITHDRAWN';

export type DepositRefundWorkflowStatus =
  | 'PROPOSED'
  | 'IN_REVIEW'
  | 'AGREED'
  | 'DISPUTED'
  | 'PAID';

export type DeductionEvidencePhoto = {
  id: string;
  area: string;
  imageUrl: string;
};

export type LifecycleCompletionState = {
  title: string;
  message: string;
};

export type DepositSettlementEntryInput = {
  role: 'LANDLORD' | 'TENANT';
  acknowledgedMoveOut: boolean;
  depositRefundStatus?: string | null;
};

export type DepositSettlementEntry = {
  label: string;
  description: string;
};

export function parseDeductionPhotoIds(photoIds?: string | null) {
  if (!photoIds) return [];

  try {
    const parsed = JSON.parse(photoIds);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function attachEvidencePhotosToDeductions<
  T extends DeductionWithStoredPhotoIds,
>(deductions: T[], photos: DeductionEvidencePhoto[]) {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  return deductions.map((deduction) => ({
    ...deduction,
    evidencePhotos: parseDeductionPhotoIds(deduction.photoIds)
      .map((id) => photoById.get(id))
      .filter((photo): photo is DeductionEvidencePhoto => Boolean(photo)),
  }));
}

export function getLifecycleCompletionState(
  refundStatus: string,
): LifecycleCompletionState | null {
  if (refundStatus !== 'PAID') return null;

  return {
    title: 'Lifecycle completed',
    message:
      'Deposit refund has been marked paid. This tenancy record is complete for move-out and settlement.',
  };
}

export function getDepositSettlementEntry({
  role,
  acknowledgedMoveOut,
  depositRefundStatus,
}: DepositSettlementEntryInput): DepositSettlementEntry | null {
  if (role !== 'LANDLORD' || !acknowledgedMoveOut) return null;

  if (!depositRefundStatus) {
    return {
      label: 'Start Deposit Settlement',
      description: 'Create the deposit refund proposal for tenant review.',
    };
  }

  if (depositRefundStatus === 'PAID') {
    return {
      label: 'View Deposit Settlement',
      description: 'Review the completed deposit settlement record.',
    };
  }

  return {
    label: 'Continue Deposit Settlement',
    description: 'Review or update the existing deposit settlement.',
  };
}

export function canLandlordWithdrawDeduction(status: string) {
  return status === 'PROPOSED' || status === 'DISPUTED';
}

export function getRefundStatusAfterDeductionWithdrawal(
  currentStatus: DepositRefundWorkflowStatus,
  deductions: { id: string; status: DepositDeductionWorkflowStatus }[],
  withdrawingDeductionId: string,
): DepositRefundWorkflowStatus {
  const remaining = deductions.filter(
    (deduction) =>
      deduction.id !== withdrawingDeductionId &&
      deduction.status !== 'WITHDRAWN',
  );

  if (remaining.length === 0) return 'AGREED';
  if (remaining.some((deduction) => deduction.status === 'DISPUTED')) {
    return 'DISPUTED';
  }
  if (remaining.some((deduction) => deduction.status === 'PROPOSED')) {
    // Stay PROPOSED if the tenant hasn't acted yet (first review still pending);
    // otherwise keep the IN_REVIEW state we transitioned into on the tenant's first response.
    return currentStatus === 'PROPOSED' ? 'PROPOSED' : 'IN_REVIEW';
  }

  return 'AGREED';
}
