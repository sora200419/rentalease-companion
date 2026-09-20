// src/app/api/payments/[id]/proof/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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

  const { id: paymentId } = await params;

  // Verify the payment belongs to this tenant's tenancy
  const payment = await prisma.rentPayment.findUnique({
    where: { id: paymentId },
    include: {
      proofs: { select: { id: true, publicId: true } },
      tenancy: {
        include: {
          room: {
            include: {
              property: {
                select: { landlordId: true, address: true },
              },
            },
          },
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!payment || payment.tenancy.tenantId !== session.user.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  if (payment.status === 'PAID' || payment.status === 'WAIVED') {
    return NextResponse.json(
      { error: 'This payment is already settled' },
      { status: 409 },
    );
  }

  // Always delete any existing proofs before uploading a new one so there
  // is never more than one proof per payment at any given time.
  if (payment.proofs.length > 0) {
    await Promise.allSettled(
      payment.proofs.map((p) =>
        cloudinary.uploader.destroy(p.publicId).catch(() => null),
      ),
    );
    await prisma.paymentProof.deleteMany({
      where: { paymentId },
    });
  }

  // Parse the multipart form data to get the image file
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Accepted: JPG, PNG, WebP, PDF' },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File must be between 1 byte and 10 MB.' },
      { status: 400 },
    );
  }

  // Convert the File to a base64 data URI for Cloudinary upload
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUri = `data:${file.type};base64,${base64}`;

  const uploadResult = await cloudinary.uploader.upload(dataUri, {
    folder: 'rentalease/payment-proofs',
    resource_type: 'auto',
  });

  // Create the proof record and update payment status in a transaction
  await prisma.$transaction([
    prisma.paymentProof.create({
      data: {
        paymentId,
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        uploadedById: session.user.id,
      },
    }),
    prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: 'UNDER_REVIEW',
        rejectionReason: null, // clear any previous rejection
      },
    }),
  ]);

  // Notify landlord to verify
  await createNotification(
    payment.tenancy.room.property.landlordId,
    'PAYMENT_PROOF_UPLOADED',
    'Payment proof uploaded',
    `${payment.tenancy.tenant.name} uploaded a payment proof for ${payment.tenancy.room.property.address}. Please verify it.`,
    `/dashboard/landlord/payments`,
  );

  return NextResponse.json({ ok: true, imageUrl: uploadResult.secure_url });
}
