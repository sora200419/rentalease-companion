import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageCorporateOccupants } from '@/lib/corporate-tenancy-access';

type ActorRole = 'LANDLORD' | 'TENANT' | 'ADMIN';

const bodySchema = z.object({
  email: z.string().trim().email('A valid tenant email is required'),
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
    },
  });

  if (!occupant) return null;

  const canManage = canManageCorporateOccupants({
    actorRole,
    isAuthorizedSignatory: occupant.tenancy.authorizedSignatoryUserId === actorId,
  });

  return canManage ? occupant : null;
}

export async function POST(
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
    const { email } = bodySchema.parse(await request.json());
    const linkedUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        role: 'TENANT',
      },
      select: { id: true, name: true, email: true },
    });

    if (!linkedUser) {
      return NextResponse.json(
        { error: 'No tenant account found with that email address' },
        { status: 404 },
      );
    }

    const updated = await prisma.corporateOccupant.update({
      where: { id: occupantId },
      data: {
        linkedUserId: linkedUser.id,
        status: 'LINKED',
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
        { error: error.issues[0]?.message ?? 'Invalid email' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to link corporate occupant' },
      { status: 500 },
    );
  }
}
