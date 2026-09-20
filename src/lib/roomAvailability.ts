import { Prisma, type TenancyStatus } from '@prisma/client';

const BLOCKING_TENANCY_STATUSES: TenancyStatus[] = ['INVITED', 'PENDING', 'ACTIVE'];

export async function syncRoomAvailability(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<void> {
  const blockingTenancyCount = await tx.tenancy.count({
    where: {
      roomId,
      status: { in: BLOCKING_TENANCY_STATUSES },
    },
  });

  await tx.room.update({
    where: { id: roomId },
    data: { isAvailable: blockingTenancyCount === 0 },
  });
}
