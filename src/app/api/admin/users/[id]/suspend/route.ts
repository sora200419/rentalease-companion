import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { logAudit, getIp } from '@/lib/audit';

const bodySchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
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
  const { suspended, reason } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true, email: true, isSuspended: true },
  });

  if (!user)
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role === 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.user.update({
    where: { id },
    data: { isSuspended: suspended },
  });

  // Audit trail — every admin action against another user is recorded forever.
  // Fire-and-forget the notification but DO await the audit log so we never
  // lose the record. If the audit insert fails we'd rather the whole request
  // 500 than have an action with no trail.
  await logAudit({
    actorId: session.user.id,
    action: suspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
    entityName: 'User',
    entityId: id,
    previousData: {
      id: user.id,
      role: user.role,
      isSuspended: user.isSuspended,
    },
    ipAddress: getIp(request),
    reason: reason ?? null,
  });

  if (suspended) {
    await createNotification(
      id,
      'ACCOUNT_SUSPENDED',
      'Account suspended',
      'Your account has been suspended. Contact support for assistance.',
      '/login',
    );
  } else {
    await createNotification(
      id,
      'ACCOUNT_REACTIVATED',
      'Account reactivated',
      'Your account has been reactivated. You can now log in.',
      user.role === 'LANDLORD' ? '/dashboard/landlord' : '/dashboard/tenant',
    );
  }

  return NextResponse.json({
    message: suspended ? 'User suspended' : 'User reactivated',
  });
}
