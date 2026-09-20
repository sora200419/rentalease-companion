// src/app/api/notifications/[id]/read/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/*
 * PATCH /api/notifications/[id]/read
 *
 * Marks a single notification as read by setting its readAt timestamp
 * to the current moment. Called from the NotificationDropdown when a
 * user clicks an individual notification.
 *
 * Security note — the ownership check
 * -----------------------------------
 * We must verify the notification belongs to the authenticated user
 * before updating it. Otherwise a malicious user could mark someone
 * else's notifications as read by guessing or harvesting IDs. The
 * findUnique + ownership check pattern here is the same one used
 * elsewhere in your codebase for tenancies, agreements, and payments.
 *
 * Why we return 404 instead of 403 for unauthorized access
 * --------------------------------------------------------
 * Returning 404 (Not Found) for both "doesn't exist" and "exists but
 * not yours" avoids leaking information about which IDs are valid in
 * the system. A 403 Forbidden response would implicitly confirm that
 * the ID is real, just belonging to another user. 404 keeps attackers
 * in the dark.
 *
 * Idempotency
 * -----------
 * Calling this endpoint on an already-read notification is a no-op that
 * returns success. We do NOT overwrite the original readAt timestamp —
 * keeping the first-read time preserved is useful for debugging and
 * potential future analytics. If the notification is already read,
 * the update just skips and returns ok.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Ownership check: only fetch the userId and readAt to minimize data
  // transfer — we don't need the whole notification row.
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true, readAt: true },
  });

  if (!notification || notification.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only update if currently unread — preserves the original read timestamp.
  if (notification.readAt === null) {
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
