import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { buildRentScheduleEntries } from '@/lib/payments';
import { getTenancyStatusAfterDepositApproval } from '@/lib/tenancyLifecycle';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: tenancyId } = await params;
  let body: { action: string; rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { action, rejectionReason } = body;

  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      agreement: { select: { status: true } },
      agreementPreferences: { select: { rentDueDay: true } },
      room: {
        include: {
          property: { select: { landlordId: true, address: true } },
        },
      },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!tenancy || tenancy.room.property.landlordId !== session.user.id) {
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  if (tenancy.depositStatus !== 'UNDER_REVIEW') {
    return NextResponse.json(
      { error: 'Deposit is not under review' },
      { status: 409 },
    );
  }

  if (action === 'APPROVE') {
    const nextTenancyStatus = getTenancyStatusAfterDepositApproval({
      currentTenancyStatus: tenancy.status,
      agreementStatus: tenancy.agreement?.status,
    });
    const tenancyWillBeActive = nextTenancyStatus === 'ACTIVE';
    const scheduledPayments = buildRentScheduleEntries(
      tenancyId,
      new Date(tenancy.startDate),
      new Date(tenancy.endDate),
      tenancy.monthlyRent,
      tenancy.agreementPreferences?.rentDueDay ?? null,
    );

    await prisma.$transaction(async (tx) => {
      await tx.tenancy.update({
        where: { id: tenancyId },
        data: {
          depositStatus: 'PAID',
          depositRejectionReason: null,
          status: nextTenancyStatus,
        },
      });

      if (tenancyWillBeActive) {
        const existingPayments = await tx.rentPayment.count({
          where: { tenancyId },
        });
        if (existingPayments === 0 && scheduledPayments.length > 0) {
          await tx.rentPayment.createMany({ data: scheduledPayments });
        }
      }
    });

    await createNotification(
      tenancy.tenantId,
      'DEPOSIT_PROOF_APPROVED',
      tenancyWillBeActive
        ? 'Deposit confirmed - tenancy is now active'
        : 'Deposit confirmed',
      tenancyWillBeActive
        ? `Your deposit payment for ${tenancy.room.property.address} has been confirmed by your landlord. The tenancy is now active and move-in condition photos can start.`
        : `Your deposit payment for ${tenancy.room.property.address} has been confirmed by your landlord.`,
      `/dashboard/tenant/tenancy`,
    );
  } else {
    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Rejection reason must be at least 10 characters' },
        { status: 400 },
      );
    }

    await prisma.tenancy.update({
      where: { id: tenancyId },
      data: {
        depositStatus: 'REJECTED',
        depositRejectionReason: rejectionReason.trim(),
      },
    });

    await createNotification(
      tenancy.tenantId,
      'DEPOSIT_PROOF_REJECTED',
      'Deposit proof rejected',
      `Your deposit proof for ${tenancy.room.property.address} was rejected. Reason: ${rejectionReason.trim()}`,
      `/dashboard/tenant/tenancy`,
    );
  }

  return NextResponse.json({ ok: true });
}
