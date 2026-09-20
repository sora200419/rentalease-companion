// src/app/api/payments/[id]/verify/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendPaymentApprovedEmail, sendPaymentRejectedEmail } from '@/lib/email';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('APPROVE') }),
  z.object({
    action: z.literal('REJECT'),
    rejectionReason: z
      .string()
      .trim()
      .min(1, 'Please provide a reason for rejection')
      .max(500, 'Rejection reason must be 500 characters or fewer'),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: paymentId } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 },
    );
  }

  // Verify the payment belongs to this landlord's property
  const payment = await prisma.rentPayment.findUnique({
    where: { id: paymentId },
    include: {
      tenancy: {
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          room: {
            include: {
              property: {
                select: { landlordId: true, address: true },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (payment.tenancy.room.property.landlordId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // We re-check status inside the conditional update below so concurrent
  // Approve+Reject clicks can't both apply. The outer check here is a fast-path
  // 409 for the common case of refreshing a page that's already been actioned.
  if (payment.status !== 'UNDER_REVIEW') {
    return NextResponse.json(
      { error: 'This payment is not awaiting verification' },
      { status: 409 },
    );
  }

  const tenantId = payment.tenancy.tenant.id;
  const tenantEmail = payment.tenancy.tenant.email;
  const tenantName = payment.tenancy.tenant.name ?? 'Tenant';
  const propertyAddress = payment.tenancy.room.property.address;
  const amountStr = Number(payment.amount).toFixed(2);
  const monthStr = new Date(payment.dueDate).toLocaleDateString('en-MY', {
    month: 'long',
    year: 'numeric',
  });

  if (parsed.data.action === 'APPROVE') {
    // Conditional update closes the race: two concurrent approve clicks
    // (or an approve racing a reject) — only the first one whose WHERE
    // clause matches UNDER_REVIEW will apply. The count tells us if we won.
    const { count } = await prisma.rentPayment.updateMany({
      where: { id: paymentId, status: 'UNDER_REVIEW' },
      data: { status: 'PAID', paidDate: new Date(), rejectionReason: null },
    });
    if (count === 0) {
      return NextResponse.json(
        { error: 'This payment was already actioned — refresh to see the latest state.' },
        { status: 409 },
      );
    }

    await createNotification(
      tenantId,
      'PAYMENT_APPROVED',
      'Payment approved',
      `Your payment for ${propertyAddress} has been approved.`,
      `/dashboard/tenant/payments`,
    );

    sendPaymentApprovedEmail(tenantEmail, tenantName, amountStr, monthStr).catch(
      (err) => console.error('[payments/verify] approval email failed:', err),
    );

    return NextResponse.json({ ok: true, status: 'PAID' });
  }

  // REJECT — same race-safe conditional update.
  const { rejectionReason } = parsed.data;
  const { count } = await prisma.rentPayment.updateMany({
    where: { id: paymentId, status: 'UNDER_REVIEW' },
    data: { status: 'PENDING', rejectionReason, paidDate: null },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: 'This payment was already actioned — refresh to see the latest state.' },
      { status: 409 },
    );
  }

  await createNotification(
    tenantId,
    'PAYMENT_REJECTED',
    'Payment proof rejected',
    `Your payment proof for ${propertyAddress} was rejected: ${rejectionReason}. Please re-upload.`,
    `/dashboard/tenant/payments`,
  );

  sendPaymentRejectedEmail(tenantEmail, tenantName, amountStr, monthStr, rejectionReason).catch(
    (err) => console.error('[payments/verify] rejection email failed:', err),
  );

  return NextResponse.json({ ok: true, status: 'PENDING' });
}
