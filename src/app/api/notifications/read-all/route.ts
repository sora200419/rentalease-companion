// src/app/api/notifications/read-all/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/*
 * PATCH /api/notifications/read-all
 *
 * Marks ALL of the authenticated user's unread notifications as read in
 * a single database operation. Triggered by the "Mark all read" button
 * in the NotificationDropdown.
 *
 * Why updateMany instead of a loop
 * --------------------------------
 * The naive alternative would be to fetch all unread notifications, then
 * update each one individually. That generates N+1 database round trips
 * for a user with N unread notifications, which for an active user could
 * be dozens of queries in a single request. Prisma's updateMany translates
 * to a single SQL UPDATE statement with a WHERE clause, which is orders
 * of magnitude faster at scale and atomic at the database level (either
 * all notifications become read together, or none do — there is no
 * partial state if the request is interrupted).
 *
 * Why we filter by readAt: null
 * -----------------------------
 * Adding `readAt: null` to the WHERE clause means we only touch rows that
 * are actually unread. Rows that are already read stay untouched, preserving
 * their original read timestamp — same reasoning as in the single-read
 * endpoint. Without this filter, clicking "Mark all read" on a mostly-read
 * inbox would rewrite read timestamps to the current moment, which would
 * confuse any future analytics or sorting by read-time.
 *
 * No body required
 * ----------------
 * The user's identity comes from the session, so this endpoint needs no
 * request body. A PATCH with no body is unusual but valid — we use PATCH
 * rather than POST because semantically we are modifying existing resources,
 * not creating anything new.
 */
export async function PATCH() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  // Returning the count is useful for debugging and also lets the client
  // show "Marked 7 notifications as read" feedback if desired in the future.
  return NextResponse.json({ ok: true, count: result.count });
}
