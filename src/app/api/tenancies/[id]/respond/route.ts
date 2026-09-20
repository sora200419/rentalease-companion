// src/app/api/tenancies/[id]/respond/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canLegallySignCorporateAgreement } from '@/lib/corporate-tenancy-access';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { logAudit, getIp } from '@/lib/audit';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'TENANT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  let body: { action: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { action } = body;

  if (!['ACCEPT', 'DECLINE'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Verify tenancy exists and belongs to this tenant
  const tenancy = await prisma.tenancy.findUnique({
    where: { id },
    include: {
      room: {
        include: {
          property: {
            select: { landlordId: true, address: true, city: true },
          },
        },
      },
      tenant: { select: { id: true, name: true, isVerified: true } },
      authorizedSignatoryUser: {
        select: { id: true, name: true, isVerified: true },
      },
    },
  });

  if (!tenancy) {
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  const isCorporate = tenancy.leasePartyType === 'CORPORATE';
  const isAuthorizedSignatory =
    !!tenancy.authorizedSignatoryUserId &&
    tenancy.authorizedSignatoryUserId === session.user.id;
  const canRespondToInvitation = isCorporate
    ? canLegallySignCorporateAgreement({
        leasePartyType: tenancy.leasePartyType,
        isAuthorizedSignatory,
      })
    : tenancy.tenantId === session.user.id;

  if (!canRespondToInvitation) {
    if (isCorporate) {
      return NextResponse.json(
        {
          error:
            'Only the authorized signatory can accept this corporate tenancy invitation.',
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  if (tenancy.status !== 'INVITED') {
    return NextResponse.json(
      { error: 'This invitation has already been responded to' },
      { status: 409 },
    );
  }

  const landlordId = tenancy.room.property.landlordId;
  const propertyAddress = tenancy.room.property.address;
  const respondingUser = isCorporate
    ? tenancy.authorizedSignatoryUser
    : tenancy.tenant;
  const responderName =
    respondingUser?.name ??
    (isCorporate ? tenancy.authorizedSignatoryName : tenancy.tenant.name);

  if (action === 'ACCEPT') {
    if (!respondingUser?.isVerified) {
      return NextResponse.json(
        {
          error:
            'You must complete identity verification before accepting an invitation. Please wait for admin approval of your identity documents.',
        },
        { status: 403 },
      );
    }

    await prisma.tenancy.update({
      where: { id },
      data: { status: 'PENDING' },
    });

    await createNotification(
      landlordId,
      'INVITATION_RESPONDED',
      'Tenant accepted your invitation',
      `${responderName} accepted the tenancy invitation for ${propertyAddress}.`,
      '/dashboard/landlord',
    );

    return NextResponse.json({ ok: true, status: 'PENDING' });
  }

  // DECLINE — delete the tenancy (it was never accepted; no financial records attached)
  // and free the room so the landlord can re-invite another tenant.
  await logAudit({
    actorId: session.user.id,
    action: 'TENANCY_DECLINED',
    entityName: 'Tenancy',
    entityId: id,
    previousData: {
      propertyId: tenancy.room.propertyId,
      roomId: tenancy.roomId,
      landlordId,
    },
    ipAddress: getIp(request),
    reason: 'DECLINED',
  });

  await prisma.$transaction([
    prisma.tenancy.delete({ where: { id } }),
    prisma.room.update({
      where: { id: tenancy.roomId },
      data: { isAvailable: true },
    }),
  ]);

  await createNotification(
    landlordId,
    'INVITATION_RESPONDED',
    'Tenant declined your invitation',
    `${responderName} declined the tenancy invitation for ${propertyAddress}.`,
    `/dashboard/landlord/properties/${tenancy.room.propertyId}`,
  );

  return NextResponse.json({ ok: true, status: 'DECLINED' });
}
