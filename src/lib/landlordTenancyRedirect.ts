import { prisma } from './prisma';

// Tenancies are hard-deleted on tenant decline/withdraw. The respond/withdraw
// API endpoints write an AuditLog row with the propertyId in previousData so
// landlord pages can send the user back to the right property instead of a
// generic list. Returns a URL the caller can pass to next/navigation redirect().
export async function getDeletedTenancyRedirectUrl(
  tenancyId: string,
  landlordId: string,
): Promise<string> {
  const log = await prisma.auditLog.findFirst({
    where: {
      entityName: 'Tenancy',
      entityId: tenancyId,
      previousData: { path: ['landlordId'], equals: landlordId },
    },
    orderBy: { createdAt: 'desc' },
    select: { previousData: true },
  });
  const propertyId = (log?.previousData as { propertyId?: string } | null)?.propertyId;
  return propertyId
    ? `/dashboard/landlord/properties/${propertyId}`
    : '/dashboard/landlord/properties';
}
