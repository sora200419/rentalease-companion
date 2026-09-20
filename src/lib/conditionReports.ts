export const CONDITION_VISIBLE_TENANCY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;

export const TENANT_REVIEWABLE_CONDITION_REPORT_STATUSES = [
  'SUBMITTED',
  'PENDING_REVIEW',
  'COUNTER_EVIDENCE_ADDED',
] as const;

const TENANT_INITIAL_REVIEWABLE_CONDITION_REPORT_STATUSES = [
  'SUBMITTED',
  'PENDING_REVIEW',
] as const;

const tenantConditionTenancyInclude = {
  room: {
    include: {
      property: {
        include: {
          landlord: { select: { name: true } },
        },
      },
    },
  },
};

export function getTenantConditionsHref(tenancyId: string) {
  return `/dashboard/tenant/conditions?tenancyId=${encodeURIComponent(tenancyId)}`;
}

export function buildTenantConditionTenancyQuery(
  tenantId: string,
  tenancyId?: string,
) {
  return {
    where: {
      ...(tenancyId ? { id: tenancyId } : {}),
      tenantId,
      status: { in: [...CONDITION_VISIBLE_TENANCY_STATUSES] },
    },
    include: tenantConditionTenancyInclude,
    orderBy: { createdAt: 'desc' as const },
  };
}

export function buildTenantConditionReviewTenancyQuery(tenantId: string) {
  return {
    where: {
      tenantId,
      status: { in: [...CONDITION_VISIBLE_TENANCY_STATUSES] },
      conditionReports: {
        some: {
          OR: [
            {
              createdById: { not: tenantId },
              status: {
                in: [...TENANT_INITIAL_REVIEWABLE_CONDITION_REPORT_STATUSES],
              },
            },
            {
              status: 'COUNTER_EVIDENCE_ADDED' as const,
              reviewedById: { not: null },
              NOT: { reviewedById: tenantId },
            },
          ],
        },
      },
    },
    include: tenantConditionTenancyInclude,
    orderBy: { createdAt: 'desc' as const },
  };
}
