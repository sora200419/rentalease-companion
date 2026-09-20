import { prisma } from '@/lib/prisma';

export async function logAudit({
  actorId,
  action,
  entityName,
  entityId,
  previousData,
  ipAddress,
  reason,
}: {
  actorId: string;
  action: string;
  entityName: string;
  entityId: string;
  previousData: object;
  ipAddress?: string | null;
  reason?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entityName,
      entityId,
      previousData,
      ipAddress: ipAddress ?? null,
      reason: reason ?? null,
    },
  });
}

export function getIp(request: Request): string | null {
  return (
    (request.headers as Headers).get('x-forwarded-for')?.split(',')[0].trim() ??
    (request.headers as Headers).get('x-real-ip') ??
    null
  );
}
