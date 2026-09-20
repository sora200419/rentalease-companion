// DELETE /api/tenancies/[id]/withdraw
// Tenant withdraws from a PENDING tenancy (accepted the invite but has not yet
// signed the agreement). The INVITED → DECLINE path is handled by /respond.
//
// Effects:
//   - Deletes the tenancy (cascades delete Agreement, RentPayment, Message,
//     ConditionReport, CoTenant rows automatically)
//   - Frees the room (isAvailable = true)
//   - Notifies the landlord
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { logAudit, getIp } from '@/lib/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'TENANT')
    return NextResponse.json({ error: 'Only tenants can withdraw from a tenancy' }, { status: 403 });

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: { id, tenantId: session.user.id, status: 'PENDING' },
    select: {
      id: true,
      roomId: true,
      room: {
        select: {
          propertyId: true,
          property: { select: { landlordId: true, address: true, city: true } },
        },
      },
      tenant: { select: { name: true } },
    },
  });

  if (!tenancy)
    return NextResponse.json(
      { error: 'Tenancy not found or cannot be withdrawn (must be in PENDING status)' },
      { status: 404 },
    );

  const landlordId = tenancy.room.property.landlordId;
  const propertyAddress = `${tenancy.room.property.address}, ${tenancy.room.property.city}`;

  await logAudit({
    actorId: session.user.id,
    action: 'TENANCY_WITHDRAWN',
    entityName: 'Tenancy',
    entityId: id,
    previousData: {
      propertyId: tenancy.room.propertyId,
      roomId: tenancy.roomId,
      landlordId,
    },
    ipAddress: getIp(request),
    reason: 'WITHDRAWN',
  });

  await prisma.$transaction([
    prisma.tenancy.delete({ where: { id } }),
    prisma.room.update({
      where: { id: tenancy.roomId },
      data: { isAvailable: true },
    }),
  ]);

  // Notify landlord (non-blocking)
  createNotification(
    landlordId,
    'INVITATION_RESPONDED',
    'Tenant withdrew from tenancy',
    `${tenancy.tenant.name} has withdrawn from the pending tenancy at ${propertyAddress}. The room is now available again.`,
    `/dashboard/landlord/properties/${tenancy.room.propertyId}`,
  );

  return NextResponse.json({ ok: true });
}
