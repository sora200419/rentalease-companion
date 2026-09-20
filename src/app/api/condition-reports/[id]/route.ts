import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deletePaymentProof } from '@/lib/cloudinary';
import { logAudit, getIp } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const report = await prisma.conditionReport.findUnique({
    where: { id },
    include: {
      photos: { select: { id: true, publicId: true } },
      tenancy: {
        include: {
          room: {
            include: {
              property: { select: { landlordId: true } },
            },
          },
        },
      },
    },
  });

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const landlordId = report.tenancy.room.property.landlordId;
  const isCreator = report.createdById === session.user.id;
  const isLandlord = landlordId === session.user.id;

  if (!isCreator && !isLandlord) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (report.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Only DRAFT reports can be deleted.' },
      { status: 409 },
    );
  }

  await logAudit({
    actorId: session.user.id,
    action: 'CONDITION_REPORT_DELETED',
    entityName: 'ConditionReport',
    entityId: id,
    previousData: report as object,
    ipAddress: getIp(req),
  });

  await Promise.allSettled(report.photos.map((p) => deletePaymentProof(p.publicId)));

  await prisma.conditionReport.delete({ where: { id } });

  return NextResponse.json({ message: 'Condition report deleted' });
}
