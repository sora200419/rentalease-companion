import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendKycRejectedEmail } from '@/lib/email';
import { logAudit, getIp } from '@/lib/audit';

const bodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Rejection reason is required')
    .max(500, 'Rejection reason must be 500 characters or fewer'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 },
    );
  }
  const { reason } = parsed.data;

  const submission = await prisma.kycSubmission.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  if (submission.status !== 'PENDING')
    return NextResponse.json({ error: 'Submission is not pending' }, { status: 409 });

  // Race-safe transition: updateMany ensures only one admin can reject.
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.kycSubmission.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectedReason: reason, reviewedById: session.user.id, reviewedAt: new Date() },
    });
    if (count === 0) return { applied: false };
    await tx.user.update({
      where: { id: submission.userId },
      data: { kycRejectedReason: reason },
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
    action: 'KYC_REJECTED',
    entityName: 'KycSubmission',
    entityId: id,
    previousData: {
      id: submission.id,
      userId: submission.userId,
      previousStatus: submission.status,
    },
    ipAddress: getIp(request),
    reason,
  });

  sendKycRejectedEmail(submission.user.email, submission.user.name, reason).catch((err) =>
    console.error('[kyc] rejection email failed:', err),
  );

  await createNotification(
    submission.userId,
    'ACCOUNT_KYC_REJECTED',
    'Identity verification rejected',
    `Your identity verification was not approved. Reason: ${reason}. Please resubmit with clearer photos.`,
    '/dashboard/kyc',
  );

  return NextResponse.json({ message: 'KYC rejected' });
}
