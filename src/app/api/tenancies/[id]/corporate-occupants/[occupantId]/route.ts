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

async function getManageableOccupant(
  tenancyId: string,
  occupantId: string,
  actorId: string,
  actorRole: ActorRole,
) {
  const occupant = await prisma.corporateOccupant.findFirst({
    where: {
      id: occupantId,
      tenancy: {
        id: tenancyId,
        leasePartyType: 'CORPORATE',
        OR: [
          { room: { property: { landlordId: actorId } } },
          { authorizedSignatoryUserId: actorId },
        ],
      },
    },
    include: {
      tenancy: {
        select: {
          authorizedSignatoryUserId: true,
        },
      },
      linkedUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!occupant) return null;

  const canManage = canManageCorporateOccupants({
    actorRole,
    isAuthorizedSignatory: occupant.tenancy.authorizedSignatoryUserId === actorId,
  });

  return canManage ? occupant : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; occupantId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id, occupantId } = await params;
  const occupant = await getManageableOccupant(
    id,
    occupantId,
    session.user.id,
    session.user.role as ActorRole,
  );

  if (!occupant) {
    return NextResponse.json(
      { error: 'Corporate occupant not found' },
      { status: 404 },
    );
  }

  try {
    const body = occupantSchema.parse(await request.json());
    const updated = await prisma.corporateOccupant.update({
      where: { id: occupantId },
      data: {
        name: body.name,
        icNumber: body.icNumber || null,
        phone: body.phone || null,
        roleLabel: body.roleLabel || null,
        status: occupant.status === 'LINKED' ? 'REPLACED' : 'UNLINKED',
        linkedUserId: null,
      },
      include: {
        linkedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid occupant details' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to update corporate occupant' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; occupantId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { id, occupantId } = await params;
  const occupant = await getManageableOccupant(
    id,
    occupantId,
    session.user.id,
    session.user.role as ActorRole,
  );

  if (!occupant) {
    return NextResponse.json(
      { error: 'Corporate occupant not found' },
      { status: 404 },
    );
  }

  const removed = await prisma.corporateOccupant.update({
    where: { id: occupantId },
    data: {
      status: 'REMOVED',
      linkedUserId: null,
    },
    include: {
      linkedUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json(removed);
}
