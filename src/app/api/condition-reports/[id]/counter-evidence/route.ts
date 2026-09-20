import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { getTenantConditionsHref } from '@/lib/conditionReports';
import { getCounterEvidenceNextStatus } from '@/lib/conditionReportWorkflow';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: { counterNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { counterNote } = body;

  const report = await prisma.conditionReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
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

  if (report.createdById === session.user.id)
    return NextResponse.json(
      { error: 'You cannot add counter evidence to your own report.' },
      { status: 400 },
    );

  if (
    !['SUBMITTED', 'PENDING_REVIEW', 'COUNTER_EVIDENCE_ADDED'].includes(
      report.status,
    )
  )
    return NextResponse.json(
      { error: 'This report is not in a reviewable state.' },
      { status: 409 },
    );

  const counterPhotoCount = await prisma.conditionPhoto.count({
    where: { reportId: id, uploadedById: session.user.id },
  });

  const hasNote =
    typeof counterNote === 'string' && counterNote.trim().length > 0;

  if (!hasNote && counterPhotoCount === 0)
    return NextResponse.json(
      {
        error:
          'Counter evidence must include a note or at least one uploaded photo.',
      },
      { status: 422 },
    );

  await prisma.conditionReport.update({
    where: { id },
    data: {
      status: getCounterEvidenceNextStatus(),
      reviewDecision: 'COUNTER_EVIDENCE_ADDED',
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      counterNote: hasNote ? counterNote.trim() : null,
    },
  });

  const reportTypeLabel =
    report.type === 'MOVE_IN'
      ? 'Move-in'
      : report.type === 'MOVE_OUT'
        ? 'Move-out'
        : 'Inspection';
  const creatorRole =
    report.createdBy.role === 'LANDLORD' ? 'landlord' : 'tenant';

  await createNotification(
    report.createdBy.id,
    'CONDITION_REPORT_COUNTER_EVIDENCE',
    `Counter evidence added to ${reportTypeLabel.toLowerCase()} condition report`,
    `${session.user.name ?? 'The other party'} added counter evidence. Please review and respond.`,
    creatorRole === 'landlord'
      ? `/dashboard/landlord/tenancies/${report.tenancyId}/conditions`
      : getTenantConditionsHref(report.tenancyId),
  );

  return NextResponse.json({ ok: true });
}
