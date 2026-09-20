import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function triggerEndingSoonNotifications(
  userId: string,
  role: 'LANDLORD' | 'TENANT',
): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + THIRTY_DAYS_MS);
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);

    const tenancies = await prisma.tenancy.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: thirtyDaysFromNow, gte: now },
        ...(role === 'LANDLORD'
          ? { room: { property: { landlordId: userId } } }
          : { tenantId: userId }),
      },
      select: {
        id: true,
        endDate: true,
        tenantId: true,
        room: {
          select: {
            property: {
              select: { landlordId: true, address: true },
            },
          },
        },
      },
    });

    for (const tenancy of tenancies) {
      const daysLeft = Math.ceil(
        (new Date(tenancy.endDate).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const address = tenancy.room.property.address;
      const landlordLink = `/dashboard/landlord/tenancies/${tenancy.id}`;
      const tenantLink = `/dashboard/tenant/tenancy`;
      const link = role === 'LANDLORD' ? landlordLink : tenantLink;

      // Skip if we already sent a TENANCY_ENDING_SOON for this specific link in the last 7 days
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: 'TENANCY_ENDING_SOON',
          link,
          createdAt: { gte: sevenDaysAgo },
        },
        select: { id: true },
      });

      if (existing) continue;

      if (role === 'LANDLORD') {
        await createNotification(
          tenancy.room.property.landlordId,
          'TENANCY_ENDING_SOON',
          'Tenancy ending soon',
          `Your tenancy at ${address} ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Consider renewing or planning handover.`,
          landlordLink,
        );
      } else {
        await createNotification(
          tenancy.tenantId,
          'TENANCY_ENDING_SOON',
          'Your tenancy is ending soon',
          `Your tenancy at ${address} ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please plan accordingly.`,
          tenantLink,
        );
      }
    }
  } catch (err) {
    console.error('[endingSoonNotifications]', err);
  }
}
