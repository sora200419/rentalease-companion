import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendKycApprovedEmail } from '@/lib/email';
import { logAudit, getIp } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const submission = await prisma.kycSubmission.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  if (submission.status !== 'PENDING')
    return NextResponse.json({ error: 'Submission is not pending' }, { status: 409 });

  // Race-safe transition: updateMany ensures only one admin can approve.
  // Two simultaneous approve clicks would otherwise both pass the status check.
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.kycSubmission.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedById: session.user.id, reviewedAt: new Date() },
    });
    if (count === 0) return { applied: false };
    await tx.user.update({
      where: { id: submission.userId },
      data: { isVerified: true, kycRejectedReason: null },
    });
    return { applied: true };
  });

  if (!result.applied) {
    return NextResponse.json(
      { error: 'This submission was already actioned — refresh to see the latest state.' },
      { status: 409 },
    );
  }

  await logAudit({
    actorId: session.user.id,
    action: 'KYC_APPROVED',
    entityName: 'KycSubmission',
    entityId: id,
    previousData: {
      id: submission.id,
      userId: submission.userId,
      previousStatus: submission.status,
    },
    ipAddress: getIp(request),
  });

  sendKycApprovedEmail(submission.user.email, submission.user.name).catch((err) =>
    console.error('[kyc] approval email failed:', err),
  );

  await createNotification(
    submission.userId,
    'ACCOUNT_VERIFIED',
    'Identity verified',
    `Welcome, ${submission.user.name}! Your identity has been verified. You can now use all features on RentalEase.`,
    submission.user.role === 'LANDLORD' ? '/dashboard/landlord/properties' : '/dashboard/tenant',
  );

  return NextResponse.json({ message: 'KYC approved' });
}
