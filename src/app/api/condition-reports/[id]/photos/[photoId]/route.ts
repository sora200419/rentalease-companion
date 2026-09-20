import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteConditionPhoto } from '@/lib/cloudinary';
import { logAudit, getIp } from '@/lib/audit';
import { isConditionReportLocked } from '@/lib/conditionReportWorkflow';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: reportId, photoId } = await params;

  // Find the photo — the where clause already enforces:
  // (1) correct report, (2) this user uploaded it.
  // No need for a separate tenancy OR check because if those two match,
  // the user is already proven to be a legitimate party.
  const photo = await prisma.conditionPhoto.findFirst({
    where: {
      id: photoId,
      reportId,
      uploadedById: session.user.id,
    },
    include: {
      report: {
        select: { status: true },
      },
    },
  });

  if (!photo)
    return NextResponse.json(
      { error: 'Photo not found, not yours, or access denied' },
      { status: 404 },
    );

  // Once locked, the report is immutable — no deletions allowed.
  if (isConditionReportLocked(photo.report.status))
    return NextResponse.json(
      { error: 'This report is locked and can no longer be modified.' },
      { status: 409 },
    );

  await logAudit({
    actorId: session.user.id,
    action: 'CONDITION_PHOTO_DELETED',
    entityName: 'ConditionPhoto',
    entityId: photoId,
    previousData: photo as object,
    ipAddress: getIp(request),
  });

  // Delete from Cloudinary first, then the DB record.
  try {
    await deleteConditionPhoto(photo.publicId);
  } catch (err) {
    console.error('Cloudinary delete failed:', err);
    // Non-blocking — still delete the DB record so user isn't stuck.
  }

  await prisma.conditionPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ message: 'Photo deleted.' });
}
