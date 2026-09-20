export const TENANCY_STEPS = ['Invite', 'Agreement', 'Deposit', 'Condition', 'Active'];

export function getTenancyStep(
  status: string,
  agreementStatus?: string | null,
  depositStatus?: string | null,
): number {
  if (status === 'INVITED') return 0;
  if (!agreementStatus || agreementStatus !== 'SIGNED') return 1;
  if (depositStatus !== 'PAID') return 2;
  if (status !== 'ACTIVE') return 3;
  return 4;
}

export type PropertyPhotoLike = {
  id?: string;
  imageUrl: string;
  caption?: string | null;
  order?: number | null;
  createdAt?: Date | string;
};

export type Tone = 'default' | 'muted' | 'success' | 'warning' | 'danger' | 'info';

function getCreatedAtTime(value: PropertyPhotoLike['createdAt']) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

export function getPropertyCover(photos: PropertyPhotoLike[]) {
  if (photos.length === 0) return null;

  const [cover] = [...photos].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return getCreatedAtTime(a.createdAt) - getCreatedAtTime(b.createdAt);
  });

  return {
    imageUrl: cover.imageUrl,
    caption: cover.caption ?? null,
  };
}

export function getPropertyCoverAlt(address: string, caption?: string | null) {
  return caption ? `${caption} for ${address}` : `Property photo for ${address}`;
}

export function getOccupancySummary({
  totalRooms,
  occupiedRooms,
}: {
  totalRooms: number;
  occupiedRooms: number;
}): { label: string; tone: Tone } {
  if (totalRooms === 0) return { label: 'No rooms', tone: 'muted' };
  if (occupiedRooms === totalRooms) return { label: 'Fully occupied', tone: 'success' };
  if (occupiedRooms === 0) return { label: 'Vacant', tone: 'default' };
  return { label: `${occupiedRooms}/${totalRooms} occupied`, tone: 'warning' };
}

export function getDashboardAttention(
  input:
    | {
        role: 'LANDLORD';
        pendingPaymentVerifications: number;
        pendingAgreementReviews: number;
        unacknowledgedConditionReports: number;
      }
    | {
        role: 'TENANT';
        pendingPaymentVerifications: number;
        pendingAgreementReviews: number;
        unacknowledgedConditionReports: number;
      }
    | {
        role: 'ADMIN';
        pendingKyc: number;
        pendingProperties: number;
      },
) {
  if (input.role === 'ADMIN') {
    if (input.pendingKyc > 0) {
      return {
        title: `${input.pendingKyc} users need KYC verification`,
        description: 'Review identity documents so verified users can continue their rental workflow.',
        actionLabel: 'Open KYC queue',
      };
    }
    if (input.pendingProperties > 0) {
      return {
        title: `${input.pendingProperties} properties need verification`,
        description: 'Review property evidence before landlords invite tenants.',
        actionLabel: 'Open property queue',
      };
    }
    return {
      title: 'Verification queues are clear',
      description: 'No user or property reviews are waiting right now.',
      actionLabel: 'View dashboard',
    };
  }

  if (input.role === 'LANDLORD') {
    if (input.pendingPaymentVerifications > 0) {
      return {
        title: `${input.pendingPaymentVerifications} payment proofs need review`,
        description: 'Confirm or reject submitted payment evidence to keep rent records current.',
        actionLabel: 'Review payments',
      };
    }
    if (input.pendingAgreementReviews > 0) {
      return {
        title: `${input.pendingAgreementReviews} agreements need attention`,
        description: 'Review requested changes before sending the next agreement version.',
        actionLabel: 'Review agreements',
      };
    }
    if (input.unacknowledgedConditionReports > 0) {
      return {
        title: `${input.unacknowledgedConditionReports} condition reports need review`,
        description: 'Check tenant-submitted condition reports and keep the tenancy record complete.',
        actionLabel: 'Review reports',
      };
    }
    return {
      title: 'Portfolio is up to date',
      description: 'No urgent landlord actions are waiting right now.',
      actionLabel: 'View properties',
    };
  }

  if (input.pendingAgreementReviews > 0) {
    return {
      title: `${input.pendingAgreementReviews} agreement needs your review`,
      description: 'Review the latest agreement terms before signing or requesting changes.',
      actionLabel: 'Review agreement',
    };
  }
  if (input.pendingPaymentVerifications > 0) {
    return {
      title: `${input.pendingPaymentVerifications} payment item needs follow-up`,
      description: 'Check payment proof status and fix rejected uploads if needed.',
      actionLabel: 'View payments',
    };
  }
  if (input.unacknowledgedConditionReports > 0) {
    return {
      title: `${input.unacknowledgedConditionReports} condition report needs acknowledgement`,
      description: 'Review property condition evidence and acknowledge the report.',
      actionLabel: 'Review condition report',
    };
  }
  return {
    title: 'Your tenancy is up to date',
    description: 'No urgent tenant actions are waiting right now.',
    actionLabel: 'View tenancy',
  };
}
