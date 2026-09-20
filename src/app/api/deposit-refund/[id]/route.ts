// GET /api/deposit-refund/[id] — fetch existing refund by tenancyId (landlord or tenant)
// POST /api/deposit-refund/[id] — landlord creates the initial refund proposal (id = tenancyId)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendDepositSettlementEmail } from '@/lib/email';
import { z } from 'zod';

// Note: the [id] segment here is the tenancyId. It shares the same dynamic
// segment name as the /deductions and /mark-paid sub-routes (which use refundId)
// because Next.js requires one consistent name per level of the URL tree.

async function verifyAccess(tenancyId: string, userId: string, role: string) {
  return prisma.tenancy.findFirst({
    where: {
      id: tenancyId,
      ...(role === 'LANDLORD'
        ? { room: { property: { landlordId: userId } } }
        : { tenantId: userId }),
    },
    select: { id: true, depositAmount: true, status: true, tenantId: true, depositStatus: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: tenancyId } = await params;
  const tenancy = await verifyAccess(tenancyId, session.user.id, session.user.role);
  if (!tenancy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const refund = await prisma.depositRefund.findUnique({
    where: { tenancyId },
    include: { deductions: { orderBy: { createdAt: 'asc' } } },
  });

  if (!refund) return NextResponse.json({ error: 'No deposit refund record yet' }, { status: 404 });
  return NextResponse.json({ refund });
}

const createSchema = z.object({
  deductions: z.array(z.object({
    reason: z.string().min(5),
    amount: z.number().positive(),
    photoIds: z.array(z.string()).default([]),
  })).default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Only landlords can initiate deposit settlement' }, { status: 403 });

  const { id: tenancyId } = await params;
  const tenancy = await verifyAccess(tenancyId, session.user.id, session.user.role);
  if (!tenancy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // BUG-05: Auto-expire any ACTIVE tenancy whose endDate has already passed,
  // so deposit settlement is not blocked just because the cron hasn't run yet.
  let effectiveStatus = tenancy.status;
  if (tenancy.status === 'ACTIVE') {
    const tenancyFull = await prisma.tenancy.findUnique({
      where: { id: tenancyId },
      select: { endDate: true },
    });
    if (tenancyFull && tenancyFull.endDate < new Date()) {
      await prisma.tenancy.update({ where: { id: tenancyId }, data: { status: 'EXPIRED' } });
      effectiveStatus = 'EXPIRED';
    }
  }

  if (!['EXPIRED', 'TERMINATED'].includes(effectiveStatus))
    return NextResponse.json({ error: 'Deposit settlement only available after tenancy ends' }, { status: 409 });

  if (tenancy.depositStatus !== 'PAID')
    return NextResponse.json({ error: 'Deposit has not been confirmed as received. Please verify the deposit payment before initiating settlement.' }, { status: 409 });

  const existing = await prisma.depositRefund.findUnique({ where: { tenancyId } });
  if (existing) return NextResponse.json({ error: 'Deposit refund already created' }, { status: 409 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const totalDeductions = parsed.data.deductions.reduce((sum, d) => sum + d.amount, 0);
  const originalAmount = Number(tenancy.depositAmount);
  const refundAmount = Math.max(0, originalAmount - totalDeductions);

  const refund = await prisma.depositRefund.create({
    data: {
      tenancyId,
      originalAmount,
      refundAmount,
      status: parsed.data.deductions.length === 0 ? 'AGREED' : 'PROPOSED',
      deductions: {
        create: parsed.data.deductions.map((d) => ({
          reason: d.reason,
          amount: d.amount,
          photoIds: JSON.stringify(d.photoIds),
          status: 'PROPOSED',
        })),
      },
    },
    include: { deductions: true },
  });

  // Notify tenant that deposit settlement has been initiated (non-blocking)
  createNotification(
    tenancy.tenantId,
    'DEPOSIT_DEDUCTION_FILED',
    'Deposit settlement started',
    `Your landlord has initiated the deposit settlement. Review the proposed deductions and respond.`,
    `/dashboard/tenant/tenancy`,
  );

  // Send email (non-blocking)
  const tenantUser = await prisma.user.findUnique({
    where: { id: tenancy.tenantId },
    select: { email: true, name: true },
  });
  const tenancyForAddress = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    select: { room: { include: { property: { select: { address: true } } } } },
  });
  if (tenantUser && tenancyForAddress) {
    sendDepositSettlementEmail(
      tenantUser.email,
      tenantUser.name,
      tenancyForAddress.room.property.address,
    ).catch(console.error);
  }

  return NextResponse.json({ refund }, { status: 201 });
}
