import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role === 'ADMIN') return NextResponse.json({ error: 'Admins do not submit KYC' }, { status: 403 });

  const submission = await prisma.kycSubmission.findUnique({
    where: { userId: session.user.id },
    select: { status: true, rejectedReason: true },
  });

  if (!submission) return NextResponse.json({ status: null });

  return NextResponse.json({
    status: submission.status,
    rejectedReason: submission.rejectedReason,
  });
}
