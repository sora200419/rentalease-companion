import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadConditionPhoto } from '@/lib/cloudinary';
import { isConditionReportLocked } from '@/lib/conditionReportWorkflow';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: reportId } = await params;

  const report = await prisma.conditionReport.findFirst({
    where: {
      id: reportId,
      tenancy: {
        OR: [
          { tenantId: session.user.id },
          { room: { property: { landlordId: session.user.id } } },
        ],
      },
    },
  });

  if (!report)
    return NextResponse.json(
      { error: 'Report not found or access denied' },
      { status: 404 },
    );

  if (isConditionReportLocked(report.status))
    return NextResponse.json(
      { error: 'This report is locked. No further changes are allowed.' },
      { status: 409 },
    );

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const room = formData.get('room') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file)
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!room || room.trim().length === 0)
      return NextResponse.json(
        { error: 'Room/area label is required' },
        { status: 400 },
      );
    if (!file.type.startsWith('image/'))
      return NextResponse.json(
        { error: 'Only image files are accepted (JPG, PNG, HEIC, etc.)' },
        { status: 400 },
      );
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 },
      );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { url, publicId } = await uploadConditionPhoto(buffer, file.name);

    const photo = await prisma.conditionPhoto.create({
      data: {
        imageUrl: url,
        publicId,
        room: room.trim(),
        caption: caption?.trim() || null,
        reportId,
        uploadedById: session.user.id,
      },
      select: { id: true, imageUrl: true, room: true, caption: true },
    });

    return NextResponse.json(
      { message: 'Photo uploaded.', photo },
      { status: 201 },
    );
  } catch (error) {
    console.error('Condition photo upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 },
    );
  }
}
