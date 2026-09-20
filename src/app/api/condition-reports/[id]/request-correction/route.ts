import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { getTenantConditionsHref } from '@/lib/conditionReports';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: { correctionNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { correctionNote } = body;

  if (
    !correctionNote ||
    typeof correctionNote !== 'string' ||
    correctionNote.trim().length === 0
  )
    return NextResponse.json(
      { error: 'correctionNote is required and must not be empty.' },
      { status: 400 },
    );

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
      { error: 'You cannot request correction on your own report.' },
      { status: 400 },
    );

  if (!['SUBMITTED', 'PENDING_REVIEW'].includes(report.status))
    return NextResponse.json(
      { error: 'This report is not in a reviewable state.' },
      { status: 409 },
    );

  await prisma.conditionReport.update({
    where: { id },
    data: {
      status: 'CORRECTION_REQUESTED',
      reviewDecision: 'CORRECTION_REQUESTED',
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      correctionNote: correctionNote.trim(),
    },
  });

  const reportTypeLabel =
    report.type === 'MOVE_IN'
      ? 'Move-in'
      : report.type === 'MOVE_OUT'
        ? 'Move-out'
        : 'Inspection';
  const creatorIsLandlord = report.createdBy.role === 'LANDLORD';

  await createNotification(
    report.createdBy.id,
    'CONDITION_REPORT_CORRECTION_REQUESTED',
    `Correction requested for ${reportTypeLabel.toLowerCase()} condition report`,
    `${session.user.name ?? 'The other party'} requested corrections: "${correctionNote.trim().slice(0, 100)}"`,
    creatorIsLandlord
      ? `/dashboard/landlord/tenancies/${report.tenancyId}/conditions`
      : getTenantConditionsHref(report.tenancyId),
  );

  return NextResponse.json({ ok: true });
}
