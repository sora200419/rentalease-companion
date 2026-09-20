import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit, getIp } from '@/lib/audit';

export function getUserDeleteBlockers({
  activeTenancyCount,
  overduePaymentCount,
  pendingDepositCount,
  unfinishedAgreementCount,
}: {
  activeTenancyCount: number;
  overduePaymentCount: number;
  pendingDepositCount: number;
  unfinishedAgreementCount: number;
}): string[] {
  const blockers: string[] = [];
  if (activeTenancyCount > 0)
    blockers.push(
      `${activeTenancyCount} active ${activeTenancyCount === 1 ? 'tenancy' : 'tenancies'}`,
    );
  if (overduePaymentCount > 0)
    blockers.push(
      `${overduePaymentCount} overdue payment${overduePaymentCount > 1 ? 's' : ''}`,
    );
  if (pendingDepositCount > 0)
    blockers.push(
      `${pendingDepositCount} pending deposit refund${pendingDepositCount > 1 ? 's' : ''}`,
    );
  if (unfinishedAgreementCount > 0)
    blockers.push(
      `${unfinishedAgreementCount} unfinished agreement${unfinishedAgreementCount > 1 ? 's' : ''}`,
    );
  return blockers;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const url = new URL(request.url);
  const reason = url.searchParams.get('reason') ?? undefined;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true },
  });

  if (!user)
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.role === 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (user.deletedAt)
    return NextResponse.json({ error: 'User already deleted' }, { status: 409 });

  const now = new Date();

  const [activeTenancies, overduePayments, pendingDeposits, unfinishedAgreements] =
    await Promise.all([
      prisma.tenancy.count({
        where: { tenantId: id, status: { in: ['INVITED', 'PENDING', 'ACTIVE'] } },
      }),
      prisma.rentPayment.count({
        where: {
          tenancy: { tenantId: id },
          status: 'PENDING',
          dueDate: { lt: now },
        },
      }),
      prisma.depositRefund.count({
        where: {
          tenancy: { tenantId: id },
          status: { not: 'PAID' },
        },
      }),
      prisma.agreement.count({
        where: {
          tenancy: { tenantId: id },
          status: { not: 'FINALIZED' },
        },
      }),
    ]);

  const blockers = getUserDeleteBlockers({
    activeTenancyCount: activeTenancies,
    overduePaymentCount: overduePayments,
    pendingDepositCount: pendingDeposits,
    unfinishedAgreementCount: unfinishedAgreements,
  });

  if (blockers.length > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${blockers.join(', ')}.` },
      { status: 400 },
    );
  }

  const fullUser = await prisma.user.findUnique({ where: { id } });

  await prisma.user.update({
    where: { id },
    data: {
      deletedAt: now,
      deletedById: session.user.id,
      deletedReason: reason ?? null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: 'USER_DELETED',
    entityName: 'User',
    entityId: id,
    previousData: fullUser as object,
    ipAddress: getIp(request),
    reason,
  });

  return NextResponse.json({ message: 'User deleted successfully' });
}
