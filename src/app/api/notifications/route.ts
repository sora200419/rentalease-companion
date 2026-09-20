// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/*
 * GET /api/notifications?limit=20&cursor=<id>
 *
 * Returns a paginated list of the authenticated user's notifications,
 * newest first. The dropdown in the TopNav calls this when opened.
 *
 * Why cursor pagination instead of offset pagination?
 * ---------------------------------------------------
 * Offset pagination (skip=20, skip=40, skip=60) is simpler to implement
 * but has a subtle correctness problem: if a new notification arrives
 * between page fetches, the user can see the same notification twice or
 * miss one entirely, because "offset 20" now points to a different row
 * than it did a second ago. Cursor pagination anchors each page to a
 * specific notification ID, so new arrivals don't disturb the pages
 * the user has already seen.
 *
 * For Phase B we only render the first page in the dropdown, so the
 * cursor parameter is unused for now. It is still implemented correctly
 * here so future phases (a dedicated notifications page with "load more")
 * work out of the box without touching this file.
 *
 * The hasMore / nextCursor pattern
 * --------------------------------
 * We fetch limit + 1 rows. If we got exactly limit + 1, there's at least
 * one more page after this one, so we return the first `limit` rows and
 * include the cursor for the next page. If we got fewer, we return them
 * all and the cursor is null. This is a standard Prisma pattern.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Clamp limit to a safe range. Defaulting to 20 is plenty for the dropdown;
  // capping at 50 prevents a malicious or buggy client from asking for
  // thousands of rows in one request.
  const rawLimit = Number(searchParams.get('limit')) || 20;
  const limit = Math.max(1, Math.min(rawLimit, 50));
  const cursor = searchParams.get('cursor');

  const rows = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // skip the cursor row itself — we already returned it last page
    }),
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ items, nextCursor });
}
