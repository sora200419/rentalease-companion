import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadPropertyPhoto, deletePropertyPhoto } from '@/lib/cloudinary';
import { logAudit, getIp } from '@/lib/audit';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, landlordId: session.user.id },
    include: {
      photos: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
  });

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  return NextResponse.json({ photos: property.photos });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, landlordId: session.user.id },
    select: { id: true },
  });

  if (!property) {
    return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const caption = formData.get('caption') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WebP images are allowed' },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let url: string, publicId: string;
  try {
    ({ url, publicId } = await uploadPropertyPhoto(buffer, file.name));
  } catch {
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 },
    );
  }

  const photo = await prisma.propertyPhoto.create({
    data: {
      imageUrl: url,
      publicId,
      caption: caption?.trim() || null,
      propertyId: id,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ photo }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const photoId = searchParams.get('photoId');

  if (!photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
  }

  const photo = await prisma.propertyPhoto.findFirst({
    where: {
      id: photoId,
      propertyId: id,
      property: { landlordId: session.user.id },
    },
  });

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  await logAudit({
    actorId: session.user.id,
    action: 'PROPERTY_PHOTO_DELETED',
    entityName: 'PropertyPhoto',
    entityId: photoId,
    previousData: photo as object,
    ipAddress: getIp(request),
  });

  try {
    await deletePropertyPhoto(photo.publicId);
  } catch {
    console.error('Cloudinary delete failed for', photo.publicId);
  }

  await prisma.propertyPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ ok: true });
}
