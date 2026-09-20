import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit, getIp } from '@/lib/audit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      tenancy: {
        include: {
          room: {
            include: {
              property: { select: { landlordId: true } },
            },
          },
        },
      },
    },
  });

  if (!agreement) return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });

  if (agreement.tenancy.room.property.landlordId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (agreement.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'Only DRAFT agreements can be deleted.' },
      { status: 409 },
    );
  }

  await logAudit({
    actorId: session.user.id,
    action: 'AGREEMENT_DELETED',
    entityName: 'Agreement',
    entityId: id,
    previousData: agreement as object,
    ipAddress: getIp(req),
  });

  await prisma.agreement.delete({ where: { id } });

  return NextResponse.json({ message: 'Agreement deleted' });
}
