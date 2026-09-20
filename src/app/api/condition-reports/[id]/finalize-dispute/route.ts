import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { getTenantConditionsHref } from '@/lib/conditionReports';
import {
  canReviewConditionReport,
  CONDITION_REPORT_COUNTER_REVIEW_STATUS,
} from '@/lib/conditionReportWorkflow';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const report = await prisma.conditionReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      reviewedBy: { select: { id: true, name: true } },
      tenancy: {
        include: {
          tenant: { select: { id: true, name: true } },
          room: {
            include: {
              property: { select: { landlordId: true, address: true } },
            },
          },
        },
      },
    },
  });

  if (!report)
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const landlordId = report.tenancy.room.property.landlordId;
  const tenantId = report.tenancy.tenant.id;
  const isLandlord = landlordId === session.user.id;
  const isTenant = tenantId === session.user.id;

  if (!isLandlord && !isTenant)
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  if (report.status !== CONDITION_REPORT_COUNTER_REVIEW_STATUS)
    return NextResponse.json(
      { error: 'Only counter evidence can be marked as disputed.' },
      { status: 409 },
    );

  if (
    !canReviewConditionReport({
      status: report.status,
      createdById: report.createdById,
      reviewedById: report.reviewedById,
      currentUserId: session.user.id,
    })
  )
    return NextResponse.json(
      { error: 'This report is not awaiting your review.' },
      { status: 409 },
    );

  await prisma.conditionReport.update({
    where: { id },
    data: {
      status: 'DISPUTED',
      acknowledgedAt: new Date(),
      acknowledgedById: session.user.id,
    },
  });

  if (report.reviewedById) {
    const reportTypeLabel =
      report.type === 'MOVE_IN'
        ? 'Move-in'
        : report.type === 'MOVE_OUT'
          ? 'Move-out'
          : 'Inspection';
    const recipientIsLandlord = report.reviewedById === landlordId;

    await createNotification(
      report.reviewedById,
      'CONDITION_REPORT_DISPUTED',
      `${reportTypeLabel} condition report marked as disputed`,
      `${session.user.name ?? 'The other party'} reviewed your counter evidence and kept the report disputed for ${report.tenancy.room.property.address}.`,
      recipientIsLandlord
        ? `/dashboard/landlord/tenancies/${report.tenancyId}/conditions`
        : getTenantConditionsHref(report.tenancyId),
    );
  }

  return NextResponse.json({ ok: true });
}
