import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { logAudit, getIp } from '@/lib/audit';

const bodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Revocation reason is required')
    .max(500, 'Reason must be 500 characters or fewer'),
});

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
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 },
    );
  }
  const { reason } = parsed.data;

  const property = await prisma.property.findUnique({
    where: { id },
    select: { id: true, address: true, landlordId: true, isVerified: true },
  });

  if (!property)
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  if (!property.isVerified)
    return NextResponse.json({ error: 'Property is not currently verified' }, { status: 400 });

  await prisma.property.update({
    where: { id },
    data: { isVerified: false, rejectedReason: reason },
  });

  await logAudit({
    actorId: session.user.id,
    action: 'PROPERTY_VERIFICATION_REVOKED',
    entityName: 'Property',
    entityId: id,
    previousData: {
      id: property.id,
      isVerified: property.isVerified,
      landlordId: property.landlordId,
    },
    ipAddress: getIp(request),
    reason,
  });

  await createNotification(
    property.landlordId,
    'PROPERTY_VERIFICATION_REVOKED',
    'Property verification revoked',
    `Your property at "${property.address}" has had its verification revoked. Reason: ${reason}. Please update the listing and it will be reviewed again.`,
    '/dashboard/landlord/properties',
  );

  return NextResponse.json({ message: 'Property verification revoked' });
}
