// PATCH /api/deposit-refund/[id]/deductions/[deductionId]
// Tenant: accept or dispute. Landlord: withdraw their own deduction.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';
import {
  canLandlordWithdrawDeduction,
  getRefundStatusAfterDeductionWithdrawal,
} from '@/lib/depositSettlementWorkflow';

const tenantSchema = z
  .object({
    action: z.enum(['ACCEPT', 'DISPUTE']),
    disputeNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'DISPUTE' && (!data.disputeNote || data.disputeNote.trim().length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please provide a dispute reason (at least 5 characters).',
        path: ['disputeNote'],
      });
    }
  });

const landlordSchema = z.object({
  action: z.literal('WITHDRAW'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deductionId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id, deductionId } = await params;

  // Verify the deduction exists and belongs to a tenancy this user is party to
  const deduction = await prisma.depositDeduction.findFirst({
    where: {
      id: deductionId,
      refundId: id,
      refund: {
        tenancy: session.user.role === 'LANDLORD'
          ? { room: { property: { landlordId: session.user.id } } }
          : { tenantId: session.user.id },
      },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      reason: true,
      refund: {
        select: {
          id: true,
          status: true,
          originalAmount: true,
          // Include id on each deduction so we can filter by id (BUG-03)
          deductions: { select: { id: true, amount: true, status: true } },
          tenancy: {
            select: {
              tenantId: true,
              room: { select: { property: { select: { landlordId: true } } } },
            },
          },
        },
      },
    },
  });

  if (!deduction) return NextResponse.json({ error: 'Deduction not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (session.user.role === 'TENANT') {
    if (deduction.status !== 'PROPOSED')
      return NextResponse.json({ error: 'Deduction already responded to' }, { status: 409 });

    const parsed = tenantSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const newStatus = parsed.data.action === 'ACCEPT' ? 'ACCEPTED' : 'DISPUTED';

    await prisma.depositDeduction.update({
      where: { id: deductionId },
      data: {
        status: newStatus,
        tenantDisputeNote: parsed.data.disputeNote ?? null,
      },
    });

    // Move refund to IN_REVIEW once tenant starts responding
    await prisma.depositRefund.update({
      where: { id },
      data: { status: 'IN_REVIEW' },
    });

    // Re-fetch all deductions after the update so the check uses fresh data (BUG-02)
    const freshDeductions = await prisma.depositDeduction.findMany({
      where: { refundId: id },
      select: { id: true, status: true, amount: true },
    });

    const nonWithdrawn = freshDeductions.filter((d) => d.status !== 'WITHDRAWN');
    const allResolved = nonWithdrawn.every((d) => ['ACCEPTED', 'DISPUTED'].includes(d.status));

    if (allResolved) {
      const hasDispute = nonWithdrawn.some((d) => d.status === 'DISPUTED');
      const finalStatus = hasDispute ? 'DISPUTED' : 'AGREED';

      // Recalculate refund amount from accepted non-withdrawn deductions (IMP-07)
      const totalDeductions = nonWithdrawn.reduce((sum, d) => sum + Number(d.amount), 0);
      const refundAmount = Math.max(0, Number(deduction.refund.originalAmount) - totalDeductions);

      await prisma.depositRefund.update({
        where: { id },
        data: { status: finalStatus, refundAmount },
      });

      // Notify landlord to upload payment proof when all deductions are agreed (IMP-12)
      if (finalStatus === 'AGREED') {
        const landlordId = deduction.refund.tenancy.room.property.landlordId;
        createNotification(
          landlordId,
          'DEPOSIT_REFUND_PAID',
          'All deductions agreed — please arrange deposit refund',
          'The tenant has agreed to all deductions. Please arrange the deposit refund payment.',
          `/dashboard/landlord/tenancies`,
        );
      }
    }

    // Notify landlord of tenant's response (non-blocking)
    const landlordId = deduction.refund.tenancy.room.property.landlordId;
    const responseLabel = parsed.data.action === 'ACCEPT' ? 'accepted' : 'disputed';
    createNotification(
      landlordId,
      'DEPOSIT_DEDUCTION_FILED',
      `Tenant ${responseLabel} a deduction`,
      `Your tenant has ${responseLabel} the deduction "${deduction.reason}" (RM ${Number(deduction.amount).toFixed(2)}).`,
      `/dashboard/landlord/tenancies`,
    );

    const updated = await prisma.depositDeduction.findUnique({ where: { id: deductionId } });
    return NextResponse.json({ deduction: updated });
  }

  // Landlord withdrawing
  const parsed = landlordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  if (!canLandlordWithdrawDeduction(deduction.status))
    return NextResponse.json(
      { error: 'Only proposed or disputed deductions can be withdrawn.' },
      { status: 409 },
    );

  await prisma.depositDeduction.update({
    where: { id: deductionId },
    data: { status: 'WITHDRAWN' },
  });

  // Recalculate refund amount excluding this deduction by ID, not amount (BUG-03)
  const remaining = deduction.refund.deductions
    .filter((d) => d.status !== 'WITHDRAWN' && d.id !== deductionId)
    .reduce((s, d) => s + Number(d.amount), 0);

  const refundStatus = getRefundStatusAfterDeductionWithdrawal(
    deduction.refund.status,
    deduction.refund.deductions,
    deductionId,
  );

  const refund = await prisma.depositRefund.update({
    where: { id },
    data: {
      refundAmount: Math.max(0, Number(deduction.refund.originalAmount) - remaining),
      status: refundStatus,
    },
  });

  const updated = await prisma.depositDeduction.findUnique({ where: { id: deductionId } });
  return NextResponse.json({ deduction: updated, refund });
}
