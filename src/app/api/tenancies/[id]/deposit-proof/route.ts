import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'TENANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: tenancyId } = await params;

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      depositProofs: { select: { id: true, publicId: true } },
      room: {
        include: {
          property: { select: { landlordId: true, address: true } },
        },
      },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (!tenancy || tenancy.tenantId !== session.user.id) {
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  if (tenancy.depositStatus === 'PAID') {
    return NextResponse.json(
      { error: 'Deposit is already confirmed as paid' },
      { status: 409 },
    );
  }

  // Delete old proofs when re-uploading after rejection
  if (tenancy.depositStatus === 'REJECTED' && tenancy.depositProofs.length > 0) {
    await Promise.allSettled(
      tenancy.depositProofs.map((p) =>
        cloudinary.uploader.destroy(p.publicId).catch(() => null),
      ),
    );
    await prisma.depositProof.deleteMany({ where: { tenancyId } });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUri = `data:${file.type};base64,${base64}`;

  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/deposit-proofs',
    resource_type: 'auto',
  });

  await prisma.$transaction([
    prisma.depositProof.create({
      data: {
        tenancyId,
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        uploadedById: session.user.id,
      },
    }),
    prisma.tenancy.update({
      where: { id: tenancyId },
      data: {
        depositStatus: 'UNDER_REVIEW',
        depositRejectionReason: null,
      },
    }),
  ]);

  await createNotification(
    tenancy.room.property.landlordId,
    'DEPOSIT_PROOF_UPLOADED',
    'Deposit proof uploaded',
    `${tenancy.tenant.name} uploaded a deposit payment proof for ${tenancy.room.property.address}. Please verify it.`,
    `/dashboard/landlord/tenancies/${tenancyId}`,
  );

  return NextResponse.json({ ok: true, imageUrl: uploadResult.secure_url });
}
