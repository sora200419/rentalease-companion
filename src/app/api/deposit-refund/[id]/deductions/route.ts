// POST /api/deposit-refund/[id]/deductions — landlord adds a deduction
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';

const deductionSchema = z.object({
  reason: z.string().min(5),
  amount: z.number().positive(),
  photoIds: z.array(z.string()).default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const refund = await prisma.depositRefund.findFirst({
    where: {
      id,
      tenancy: { room: { property: { landlordId: session.user.id } } },
      status: { in: ['PROPOSED', 'IN_REVIEW'] },
    },
    select: {
      id: true,
      originalAmount: true,
      deductions: { select: { amount: true, status: true } },
      tenancy: { select: { tenantId: true } },
    },
  });

  if (!refund) return NextResponse.json({ error: 'Refund not found or not editable' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = deductionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const currentDeductions = refund.deductions
    .filter((d) => d.status !== 'WITHDRAWN')
    .reduce((s, d) => s + Number(d.amount), 0);

  const newTotal = currentDeductions + parsed.data.amount;
  const refundAmount = Math.max(0, Number(refund.originalAmount) - newTotal);

  const [deduction] = await prisma.$transaction([
    prisma.depositDeduction.create({
      data: {
        refundId: id,
        reason: parsed.data.reason,
        amount: parsed.data.amount,
        photoIds: JSON.stringify(parsed.data.photoIds),
        status: 'PROPOSED',
      },
    }),
    prisma.depositRefund.update({
      where: { id },
      data: { refundAmount },
    }),
  ]);

  // Notify tenant of the new deduction (non-blocking)
  createNotification(
    refund.tenancy.tenantId,
    'DEPOSIT_DEDUCTION_FILED',
    'New deposit deduction added',
    `Your landlord has added a deduction of RM ${parsed.data.amount.toFixed(2)}: ${parsed.data.reason}. Please review and respond.`,
    `/dashboard/tenant/tenancy`,
  );

  return NextResponse.json({ deduction }, { status: 201 });
}
