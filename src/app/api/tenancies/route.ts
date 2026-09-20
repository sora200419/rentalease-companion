// src/app/api/tenancies/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendInvitationEmail } from '@/lib/email';
import { buildCorporateTenancyCreateInput } from '@/lib/corporate-tenancy';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;

  if (role === 'LANDLORD') {
    const tenancies = await prisma.tenancy.findMany({
      where: {
        room: { property: { landlordId: session.user.id } },
      },
      include: {
        tenant: {
          select: { id: true, name: true, email: true, phone: true },
        },
        room: {
          include: {
            property: {
              select: { id: true, address: true, city: true, state: true },
            },
          },
        },
        agreement: { select: { id: true, status: true } },
        rentPayments: {
          select: { id: true, status: true, dueDate: true, amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tenancies);
  }

  const tenancies = await prisma.tenancy.findMany({
    where: { tenantId: session.user.id },
    include: {
      room: {
        include: {
          property: {
            include: {
              landlord: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      },
      agreement: { select: { id: true, status: true } },
      rentPayments: {
        select: { id: true, status: true, dueDate: true, amount: true },
        orderBy: { dueDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(tenancies);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const leasePartyType =
    body.leasePartyType === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL';
  const { roomId, tenantEmail, startDate, endDate, monthlyRent, depositAmount } =
    body;

  if (
    typeof roomId !== 'string' ||
    typeof startDate !== 'string' ||
    typeof endDate !== 'string' ||
    typeof monthlyRent !== 'number' ||
    typeof depositAmount !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 },
    );
  }

  if (
    leasePartyType === 'INDIVIDUAL' &&
    (typeof tenantEmail !== 'string' || !tenantEmail.trim())
  ) {
    return NextResponse.json(
      { error: 'Tenant email is required' },
      { status: 400 },
    );
  }

  if (
    leasePartyType === 'CORPORATE' &&
    (
      typeof body.companyName !== 'string' ||
      !body.companyName.trim() ||
      typeof body.authorizedSignatoryName !== 'string' ||
      !body.authorizedSignatoryName.trim() ||
      typeof body.authorizedSignatoryEmail !== 'string' ||
      !body.authorizedSignatoryEmail.trim()
    )
  ) {
    return NextResponse.json(
      {
        error:
          'Company name, authorized signatory name, and authorized signatory email are required for corporate tenancies',
      },
      { status: 400 },
    );
  }

  const today = new Date().toISOString().split('T')[0];
  if (startDate < today) {
    return NextResponse.json(
      { error: 'Start date cannot be in the past' },
      { status: 400 },
    );
  }

  if (endDate <= startDate) {
    return NextResponse.json(
      { error: 'End date must be after start date' },
      { status: 400 },
    );
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      property: {
        select: {
          landlordId: true,
          address: true,
          city: true,
          isVerified: true,
        },
      },
    },
  });

  if (!room || room.property.landlordId !== session.user.id) {
    return NextResponse.json(
      { error: 'Room not found or access denied' },
      { status: 404 },
    );
  }

  if (!room.property.isVerified) {
    return NextResponse.json(
      {
        error:
          'This property has not been verified by an admin yet. You cannot invite tenants until it is approved.',
      },
      { status: 403 },
    );
  }

  if (!room.isAvailable) {
    return NextResponse.json(
      { error: 'Room is not available' },
      { status: 409 },
    );
  }

  let tenancy;
  let invitationRecipient:
    | { id: string; name: string | null; email: string | null }
    | null = null;
  let invitationEmail: string | null = null;
  let invitationName = 'Tenant';

  try {
  if (leasePartyType === 'INDIVIDUAL') {
    const tenant = await prisma.user.findUnique({
      where: { email: tenantEmail.trim() },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!tenant || tenant.role !== 'TENANT') {
      return NextResponse.json(
        { error: 'No tenant account found with that email address' },
        { status: 404 },
      );
    }

    tenancy = await prisma.$transaction(async (tx) => {
      const claimed = await tx.room.updateMany({ where: { id: roomId, isAvailable: true }, data: { isAvailable: false } });
      if (claimed.count === 0) throw new Error('ROOM_UNAVAILABLE');
      const created = await tx.tenancy.create({
        data: {
          roomId,
          tenantId: tenant.id,
          leasePartyType: 'INDIVIDUAL',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          monthlyRent,
          depositAmount,
          status: 'INVITED',
        },
        include: {
          room: {
            include: { property: { select: { address: true, city: true } } },
          },
          tenant: { select: { id: true, name: true, email: true } },
        },
      });
      return created;
    });

    invitationRecipient = tenant;
    invitationEmail = tenant.email;
    invitationName = tenant.name ?? 'Tenant';
  } else {
    const corporateInput = buildCorporateTenancyCreateInput({
      roomId,
      startDate,
      endDate,
      monthlyRent,
      depositAmount,
      companyName: body.companyName,
      companyRegistrationNo: body.companyRegistrationNo,
      authorizedSignatoryName: body.authorizedSignatoryName,
      authorizedSignatoryIC: body.authorizedSignatoryIC,
      authorizedSignatoryRole: body.authorizedSignatoryRole,
      authorizedSignatoryEmail: body.authorizedSignatoryEmail,
      occupants: Array.isArray(body.occupants) ? body.occupants : [],
    });

    const authorizedSignatoryUser = corporateInput.authorizedSignatoryEmail
      ? await prisma.user.findUnique({
          where: { email: corporateInput.authorizedSignatoryEmail },
          select: { id: true, name: true, email: true, role: true },
        })
      : null;

    if (!authorizedSignatoryUser || authorizedSignatoryUser.role !== 'TENANT') {
      return NextResponse.json(
        {
          error:
            'The authorized signatory email must belong to an existing tenant account before you can create a corporate tenancy.',
        },
        { status: 404 },
      );
    }

    tenancy = await prisma.$transaction(async (tx) => {
      const claimed = await tx.room.updateMany({ where: { id: roomId, isAvailable: true }, data: { isAvailable: false } });
      if (claimed.count === 0) throw new Error('ROOM_UNAVAILABLE');
      const created = await tx.tenancy.create({
        data: {
          roomId,
          tenantId: authorizedSignatoryUser.id,
          leasePartyType: 'CORPORATE',
          companyName: corporateInput.companyName,
          companyRegistrationNo: corporateInput.companyRegistrationNo,
          authorizedSignatoryName: corporateInput.authorizedSignatoryName,
          authorizedSignatoryIC: corporateInput.authorizedSignatoryIC,
          authorizedSignatoryRole: corporateInput.authorizedSignatoryRole,
          authorizedSignatoryUserId: authorizedSignatoryUser.id,
          startDate: new Date(corporateInput.startDate),
          endDate: new Date(corporateInput.endDate),
          monthlyRent: corporateInput.monthlyRent,
          depositAmount: corporateInput.depositAmount,
          status: 'INVITED',
          corporateOccupants: {
            create: corporateInput.occupants.map((occupant) => ({
              name: occupant.name,
              icNumber: occupant.icNumber,
              phone: occupant.phone,
              roleLabel: occupant.roleLabel,
            })),
          },
        },
        include: {
          room: {
            include: { property: { select: { address: true, city: true } } },
          },
          tenant: { select: { id: true, name: true, email: true } },
        },
      });
      return created;
    });

    invitationRecipient = authorizedSignatoryUser;
    invitationEmail = authorizedSignatoryUser.email;
    invitationName =
      authorizedSignatoryUser.name ?? corporateInput.authorizedSignatoryName;
  }
  } catch (err) {
    if (err instanceof Error && err.message === 'ROOM_UNAVAILABLE') {
      return NextResponse.json({ error: 'Room is no longer available' }, { status: 409 });
    }
    throw err;
  }

  if (invitationRecipient) {
    await createNotification(
      invitationRecipient.id,
      'INVITATION_RECEIVED',
      'New tenancy invitation',
      `You have received a tenancy invitation for ${room.property.address}, ${room.property.city}.`,
      '/dashboard/tenant/tenancy',
    );
  }

  const landlordUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  if (invitationEmail) {
    sendInvitationEmail(
      invitationEmail,
      invitationName,
      `${room.property.address}, ${room.property.city}`,
      landlordUser?.name ?? 'Your landlord',
    ).catch(console.error);
  }

  return NextResponse.json(tenancy, { status: 201 });
}
