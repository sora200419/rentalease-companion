import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { logAudit, getIp } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    select: { id: true, address: true, landlordId: true, isVerified: true },
  });

  if (!property)
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  await prisma.property.update({
    where: { id },
    data: { isVerified: true, rejectedReason: null },
  });

  await logAudit({
    actorId: session.user.id,
    action: 'PROPERTY_VERIFIED',
    entityName: 'Property',
    entityId: id,
    previousData: {
      id: property.id,
      isVerified: property.isVerified,
      landlordId: property.landlordId,
    },
    ipAddress: getIp(request),
  });

  await createNotification(
    property.landlordId,
    'PROPERTY_VERIFICATION_APPROVED',
    'Property listing approved',
    `Your property at "${property.address}" has been verified and is now live on RentalEase.`,
    '/dashboard/landlord/properties',
  );

  return NextResponse.json({ message: 'Property verified successfully' });
}
