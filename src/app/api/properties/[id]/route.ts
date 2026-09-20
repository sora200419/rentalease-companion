import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit, getIp } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, landlordId: session.user.id },
    include: {
      rooms: {
        include: {
          tenancies: {
            where: { status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] } },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const hasActiveTenancy = property.rooms.some((r) => r.tenancies.length > 0);
  if (hasActiveTenancy) {
    return NextResponse.json(
      { error: 'Cannot delete a property that has tenancy records. All tenancies must be fully settled first.' },
      { status: 409 },
    );
  }

  const ip = getIp(req);

  for (const room of property.rooms) {
    await logAudit({
      actorId: session.user.id,
      action: 'ROOM_DELETED',
      entityName: 'Room',
      entityId: room.id,
      previousData: room as object,
      ipAddress: ip,
    });
  }

  await logAudit({
    actorId: session.user.id,
    action: 'PROPERTY_DELETED',
    entityName: 'Property',
    entityId: id,
    previousData: property as object,
    ipAddress: ip,
  });

  // Delete rooms first (no cascade), then property (photos cascade via schema)
  await prisma.room.deleteMany({ where: { propertyId: id } });
  await prisma.property.delete({ where: { id } });

  return NextResponse.json({ message: 'Property deleted' });
}
