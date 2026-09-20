import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageCorporateOccupants } from '@/lib/corporate-tenancy-access';

type ActorRole = 'LANDLORD' | 'TENANT' | 'ADMIN';

const occupantSchema = z.object({
  name: z.string().trim().min(1, 'Occupant name is required').max(100),
  icNumber: z.string().trim().max(30).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  roleLabel: z.string().trim().max(100).optional().nullable(),
});

async function getManageableCorporateTenancy(
  tenancyId: string,
  actorId: string,
  actorRole: ActorRole,
) {
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id: tenancyId,
      leasePartyType: 'CORPORATE',
      OR: [
        { room: { property: { landlordId: actorId } } },
        { authorizedSignatoryUserId: actorId },
      ],
    },
    select: {
      id: true,
      authorizedSignatoryUserId: true,
    },
  });

  if (!tenancy) return null;

  const canManage = canManageCorporateOccupants({
    actorRole,
    isAuthorizedSignatory: tenancy.authorizedSignatoryUserId === actorId,
  });

  return canManage ? tenancy : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id } = await params;
  const tenancy = await getManageableCorporateTenancy(
    id,
    session.user.id,
    session.user.role as ActorRole,
  );

  if (!tenancy) {
    return NextResponse.json(
      { error: 'Corporate tenancy not found' },
      { status: 404 },
    );
  }

  const occupants = await prisma.corporateOccupant.findMany({
    where: { tenancyId: id },
    include: {
      linkedUser: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(occupants);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id } = await params;
  const tenancy = await getManageableCorporateTenancy(
    id,
    session.user.id,
    session.user.role as ActorRole,
  );

  if (!tenancy) {
    return NextResponse.json(
      { error: 'Corporate tenancy not found' },
      { status: 404 },
    );
  }

  try {
    const body = occupantSchema.parse(await request.json());
    const occupant = await prisma.corporateOccupant.create({
      data: {
        tenancyId: id,
        name: body.name,
        icNumber: body.icNumber || null,
        phone: body.phone || null,
        roleLabel: body.roleLabel || null,
      },
      include: {
        linkedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(occupant, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid occupant details' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to add corporate occupant' },
      { status: 500 },
    );
  }
}
