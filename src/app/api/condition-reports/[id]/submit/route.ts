import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { getTenantConditionsHref } from '@/lib/conditionReports';

const MOVE_IN_OUT_MIN_PHOTOS = 6;
const MOVE_IN_OUT_MIN_CHECKLIST = 4;
const INSPECTION_MIN_PHOTOS = 1;

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const report = await prisma.conditionReport.findFirst({
    where: {
      id,
      createdById: session.user.id,
    },
    include: {
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
      _count: {
        select: { photos: true, checklistItems: true },
      },
    },
  });

  if (!report)
    return NextResponse.json(
      { error: 'Report not found or you are not the creator' },
      { status: 404 },
    );

  if (!['DRAFT', 'CORRECTION_REQUESTED'].includes(report.status))
    return NextResponse.json(
      { error: 'Only DRAFT or CORRECTION_REQUESTED reports can be submitted.' },
      { status: 409 },
    );

  const photoCount = report._count.photos;
  const checklistCount = report._count.checklistItems;

  if (report.type !== 'INSPECTION') {
    if (photoCount < MOVE_IN_OUT_MIN_PHOTOS)
      return NextResponse.json(
        {
          error: `At least ${MOVE_IN_OUT_MIN_PHOTOS} photos are required for a ${report.type.replace('_', '-').toLowerCase()} report. Currently: ${photoCount}.`,
        },
        { status: 422 },
      );
    if (checklistCount < MOVE_IN_OUT_MIN_CHECKLIST)
      return NextResponse.json(
        {
          error: `At least ${MOVE_IN_OUT_MIN_CHECKLIST} evidence areas must be completed. Currently: ${checklistCount}.`,
        },
        { status: 422 },
      );
  } else {
    if (photoCount < INSPECTION_MIN_PHOTOS)
      return NextResponse.json(
        { error: 'At least 1 photo is required for an inspection report.' },
        { status: 422 },
      );
  }

  await prisma.conditionReport.update({
    where: { id },
    data: {
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
      correctionNote: null,
    },
  });

  const landlordId = report.tenancy.room.property.landlordId;
  const isCreatorLandlord = landlordId === session.user.id;
  const reportTypeLabel =
    report.type === 'MOVE_IN'
      ? 'Move-in'
      : report.type === 'MOVE_OUT'
        ? 'Move-out'
        : 'Inspection';

  if (isCreatorLandlord) {
    await createNotification(
      report.tenancy.tenant.id,
      'CONDITION_REPORT_SUBMITTED',
      `${reportTypeLabel} condition report ready for review`,
      `Your landlord submitted a ${reportTypeLabel.toLowerCase()} condition report for ${report.tenancy.room.property.address}. Please review and respond.`,
      getTenantConditionsHref(report.tenancyId),
    );
  } else {
    await createNotification(
      landlordId,
      'CONDITION_REPORT_SUBMITTED',
      `${reportTypeLabel} condition report ready for review`,
      `${report.tenancy.tenant.name} submitted a ${reportTypeLabel.toLowerCase()} condition report. Please review and respond.`,
      `/dashboard/landlord/tenancies/${report.tenancyId}/conditions`,
    );
  }

  return NextResponse.json({ ok: true });
}
