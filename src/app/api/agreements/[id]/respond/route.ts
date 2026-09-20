// src/app/api/agreements/[id]/respond/route.ts
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildAgreementEvent,
  formatChangeRequestSummary,
  normalizeChangeRequest,
} from '@/lib/agreements/history';
import { createNotification } from '@/lib/notifications';
import { sendSystemMessage } from '@/lib/messages';
import { anchorHashToBlockchain } from '@/lib/blockchain';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'TENANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { action, negotiationNotes, signedAcknowledged, changeRequests } = body;

  if (!['SIGN', 'REQUEST_CHANGES'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  if (action === 'SIGN' && signedAcknowledged !== true) {
    return NextResponse.json(
      { error: 'Please acknowledge the agreement before signing.' },
      { status: 400 },
    );
  }

  const normalizedRequests =
    action === 'REQUEST_CHANGES' && Array.isArray(changeRequests)
      ? changeRequests
          .map((request) =>
            normalizeChangeRequest({
              category: String(request?.category ?? ''),
              requestedChange: String(request?.requestedChange ?? ''),
              reason: String(request?.reason ?? ''),
              note:
                request?.note === undefined || request?.note === null
                  ? null
                  : String(request.note),
            }),
          )
          .filter(
            (request) =>
              request.category &&
              request.requestedChange &&
              request.reason,
          )
      : [];

  if (action === 'REQUEST_CHANGES' && normalizedRequests.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one structured change request before sending.' },
      { status: 400 },
    );
  }

  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      tenancy: {
        include: {
          tenant: { select: { id: true, name: true } },
          authorizedSignatoryUser: { select: { id: true, name: true } },
          room: {
            include: {
              property: {
                select: { landlordId: true, address: true },
              },
            },
          },
          agreementPreferences: { select: { rentDueDay: true } },
        },
      },
    },
  });

  if (!agreement) {
    return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  }

  if (agreement.tenancy.tenantId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (
    agreement.tenancy.leasePartyType === 'CORPORATE' &&
    agreement.tenancy.authorizedSignatoryUserId !== session.user.id
  ) {
    return NextResponse.json(
      {
        error:
          'Only the authorized signatory can complete the legal agreement response for this corporate tenancy.',
      },
      { status: 403 },
    );
  }

  if (agreement.status !== 'FINALIZED') {
    return NextResponse.json(
      { error: 'This agreement is not in a state that can be responded to' },
      { status: 409 },
    );
  }

  const landlordId = agreement.tenancy.room.property.landlordId;
  const propertyAddress = agreement.tenancy.room.property.address;
  const tenantName = agreement.tenancy.tenant.name;
  const signerLabel =
    agreement.tenancy.leasePartyType === 'CORPORATE'
      ? agreement.tenancy.authorizedSignatoryName ?? tenantName
      : tenantName;

  if (action === 'SIGN') {
    const forwarded = request.headers.get('x-forwarded-for');
    const signedByIp = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    const contentHash = crypto
      .createHash('sha256')
      .update(agreement.rawContent)
      .digest('hex');

    await prisma.$transaction([
      prisma.agreement.update({
        where: { id },
        data: {
          status: 'PENDING_SIGNATURE_PROOF',
          contentHash,
          signedAt: new Date(),
          signedByIp,
          signedAcknowledged,
        },
      }),
      prisma.agreementEvent.create({
        data: buildAgreementEvent({
          agreementId: id,
          type: 'DIGITAL_SIGNED',
          actorRole: 'TENANT',
          actorUserId: session.user.id,
          summary:
            agreement.tenancy.leasePartyType === 'CORPORATE'
              ? 'Authorized signatory completed the digital signature. Signed hard-copy proof is still pending landlord review.'
              : 'Tenant completed the digital signature. Signed hard-copy proof is still pending landlord review.',
        }),
      }),
    ]);

    await createNotification(
      landlordId,
      'AGREEMENT_SIGNED',
      agreement.tenancy.leasePartyType === 'CORPORATE'
        ? 'Authorized signatory completed digital signing'
        : 'Tenant completed digital signing',
      `${signerLabel} completed the digital signature for ${propertyAddress}. The tenancy is still pending the signed hard-copy upload and your approval.`,
      `/dashboard/landlord/tenancies/${agreement.tenancyId}`,
    );

    await createNotification(
      session.user.id,
      'AGREEMENT_SIGNED',
      'Upload your signed hard copy to finish the agreement',
      `Your digital signature for ${propertyAddress} was recorded. Upload the signed hard-copy PDF or image so the landlord can approve it before the tenancy starts.`,
      '/dashboard/tenant/tenancy',
    );

    anchorHashToBlockchain(contentHash)
      .then((txHash) =>
        prisma.agreement.update({ where: { id }, data: { txHash } }),
      )
      .catch((err) => console.error('[Blockchain] Anchor failed:', err));

    return NextResponse.json({ ok: true, status: 'PENDING_SIGNATURE_PROOF' });
  }

  const compiledNotes = formatChangeRequestSummary(
    normalizedRequests,
    typeof negotiationNotes === 'string' ? negotiationNotes : null,
  );

  await prisma.$transaction([
    prisma.agreement.update({
      where: { id },
      data: {
        status: 'NEGOTIATING',
        negotiationNotes: compiledNotes,
        negotiationRound: { increment: 1 },
      },
    }),
    prisma.agreementChangeRequest.createMany({
      data: normalizedRequests.map((changeRequest) => ({
        agreementId: id,
        category: changeRequest.category,
        requestedChange: changeRequest.requestedChange,
        reason: changeRequest.reason,
        note: changeRequest.note,
        createdByUserId: session.user.id,
      })),
    }),
    prisma.agreementEvent.create({
      data: buildAgreementEvent({
        agreementId: id,
        type: 'REQUESTED_CHANGES',
        actorRole: 'TENANT',
        actorUserId: session.user.id,
        summary:
          agreement.tenancy.leasePartyType === 'CORPORATE'
            ? `Authorized signatory requested ${normalizedRequests.length} structured agreement change(s).`
            : `Tenant requested ${normalizedRequests.length} structured agreement change(s).`,
      }),
    }),
  ]);

  await sendSystemMessage(
    agreement.tenancyId,
    session.user.id,
    landlordId,
    `${agreement.tenancy.leasePartyType === 'CORPORATE' ? 'Authorized signatory' : 'Tenant'} requested agreement changes (Round ${agreement.negotiationRound + 1}):\n\n${compiledNotes}`,
  );

  await createNotification(
    landlordId,
    'AGREEMENT_CHANGES_REQUESTED',
    agreement.tenancy.leasePartyType === 'CORPORATE'
      ? 'Authorized signatory requested agreement changes'
      : 'Tenant requested agreement changes',
    `${signerLabel} requested changes to the agreement for ${propertyAddress}. Please review their notes and regenerate.`,
    `/dashboard/landlord/tenancies/${agreement.tenancyId}`,
  );

  return NextResponse.json({ ok: true, status: 'NEGOTIATING' });
}
