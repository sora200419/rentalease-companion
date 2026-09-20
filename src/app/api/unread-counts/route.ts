// src/app/api/unread-counts/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [messageCount, notificationCount] = await Promise.all([
    // Messages where this user is the receiver and message is unread.
    // Uses the `read` Boolean field on the Message model (not readAt).
    prisma.message.count({
      where: {
        receiverId: userId,
        read: false,
      },
    }),
    prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({ messageCount, notificationCount });
}
