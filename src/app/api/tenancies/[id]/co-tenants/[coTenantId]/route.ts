import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAudit, getIp } from '@/lib/audit';

// DELETE — remove a co-tenant (landlord only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; coTenantId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id, coTenantId } = await params;

  const coTenant = await prisma.coTenant.findFirst({
    where: {
      id: coTenantId,
      tenancy: {
        id,
        room: { property: { landlordId: session.user.id } },
      },
    },
  });

  if (!coTenant)
    return NextResponse.json({ error: 'Co-tenant not found' }, { status: 404 });

  await logAudit({
    actorId: session.user.id,
    action: 'CO_TENANT_DELETED',
    entityName: 'CoTenant',
    entityId: coTenantId,
    previousData: coTenant as object,
    ipAddress: getIp(request),
  });

  await prisma.coTenant.delete({ where: { id: coTenantId } });

  return NextResponse.json({ ok: true });
}
