import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { buildAgreementEvent } from '@/lib/agreements/history';
import { uploadAgreementSignatureProof } from '@/lib/cloudinary';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'TENANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      signatureProofs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
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

  if (!agreement || agreement.tenancy.tenantId !== session.user.id) {
    return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  }

  if (agreement.status !== 'PENDING_SIGNATURE_PROOF') {
    return NextResponse.json(
      { error: 'Hard-copy proof can only be uploaded after digital signing.' },
      { status: 409 },
    );
  }

  const latestProof = agreement.signatureProofs[0] ?? null;
  if (latestProof?.status === 'UNDER_REVIEW') {
    return NextResponse.json(
      { error: 'Your signed copy is already under landlord review.' },
      { status: 409 },
    );
  }

  if (latestProof?.status === 'APPROVED') {
    return NextResponse.json(
      { error: 'Your signed copy has already been approved.' },
      { status: 409 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, JPG, PNG, and HEIC files are accepted.' },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File must be between 1 byte and 10 MB.' },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { url, publicId } = await uploadAgreementSignatureProof(
    buffer,
    file.name,
    file.type,
  );

  const createdProof = await prisma.$transaction(async (tx) => {
    const proof = await tx.agreementSignatureProof.create({
      data: {
        agreementId: id,
        uploadedById: session.user.id,
        fileUrl: url,
        publicId,
        originalName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        status: 'UNDER_REVIEW',
      },
    });

    await tx.agreementEvent.create({
      data: buildAgreementEvent({
        agreementId: id,
        type: 'SIGNATURE_PROOF_UPLOADED',
        actorRole: 'TENANT',
        actorUserId: session.user.id,
        summary: 'Tenant uploaded the signed hard-copy proof for landlord review.',
      }),
    });

    return proof;
  });

  await createNotification(
    agreement.tenancy.room.property.landlordId,
    'AGREEMENT_SIGNATURE_PROOF_UPLOADED',
    'Signed agreement copy uploaded',
    `${agreement.tenancy.tenant.name} uploaded a signed hard-copy agreement for ${agreement.tenancy.room.property.address}. Review it before the tenancy starts.`,
    `/dashboard/landlord/tenancies/${agreement.tenancyId}`,
  );

  return NextResponse.json({
    ok: true,
    proof: {
      id: createdProof.id,
      fileUrl: createdProof.fileUrl,
      originalName: createdProof.originalName,
      mimeType: createdProof.mimeType,
      fileSize: createdProof.fileSize,
      status: createdProof.status,
    },
  });
}
