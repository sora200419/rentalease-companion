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

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, isVerified: true },
  });

  if (!user || user.role === 'ADMIN')
    return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!user.isVerified)
    return NextResponse.json({ error: 'User is not currently verified' }, { status: 400 });

  await prisma.user.update({
    where: { id },
    data: { isVerified: false, kycRejectedReason: reason },
  });

  await logAudit({
    actorId: session.user.id,
    action: 'USER_VERIFICATION_REVOKED',
    entityName: 'User',
    entityId: id,
    previousData: { id: user.id, role: user.role, isVerified: user.isVerified },
    ipAddress: getIp(request),
    reason,
  });

  await createNotification(
    id,
    'ACCOUNT_VERIFICATION_REVOKED',
    'Identity verification revoked',
    `Your identity verification has been revoked by an admin. Reason: ${reason}. Please re-upload your documents for review.`,
    '/dashboard/profile',
  );

  return NextResponse.json({ message: 'Verification revoked' });
}
