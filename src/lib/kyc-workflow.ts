export type KycSubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

export type KycPageState = 'redirect-profile' | 'under-review' | 'resubmit' | 'wizard';

export function getKycPageState({
  isVerified,
  submissionStatus,
}: {
  isVerified: boolean;
  submissionStatus: KycSubmissionStatus;
}): KycPageState {
  if (isVerified) return 'redirect-profile';
  if (submissionStatus === 'PENDING') return 'under-review';
  if (submissionStatus === 'REJECTED') return 'resubmit';
  return 'wizard';
}

export function shouldResetKycForIcChange({
  previousIcNumber,
  nextIcNumber,
  hasKycSubmission,
}: {
  previousIcNumber: string | null;
  nextIcNumber: string | null;
  hasKycSubmission: boolean;
}) {
  return hasKycSubmission && previousIcNumber !== nextIcNumber;
}

export function getAdminVerificationHref({
  pendingKycSubmissions,
}: {
  pendingKycSubmissions: number;
}) {
  return pendingKycSubmissions > 0
    ? '/dashboard/admin/kyc'
    : '/dashboard/admin/properties';
}
