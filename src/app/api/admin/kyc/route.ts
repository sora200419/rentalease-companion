import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const submissions = await prisma.kycSubmission.findMany({
    where: { status: 'PENDING' },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  return NextResponse.json({ submissions });
}
