import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/messages/unread
// Returns the count of unread messages for the current user.
// Designed to be called frequently (on page load / polling) so it's
// intentionally minimal — just a number, nothing else.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ count: 0 });

  const count = await prisma.message.count({
    where: {
      receiverId: session.user.id,
      read: false,
    },
  });

  return NextResponse.json({ count });
}
