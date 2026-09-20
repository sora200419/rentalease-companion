import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  icNumber: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

// GET — list co-tenants for a tenancy
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      ...(session.user.role === 'LANDLORD'
        ? { room: { property: { landlordId: session.user.id } } }
        : { tenantId: session.user.id }),
    },
    select: { id: true },
  });

  if (!tenancy)
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });

  const coTenants = await prisma.coTenant.findMany({
    where: { tenancyId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(coTenants);
}

// POST — add a co-tenant (landlord only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      room: { property: { landlordId: session.user.id } },
      status: { in: ['INVITED', 'PENDING', 'ACTIVE'] },
    },
    select: { id: true },
  });

  if (!tenancy)
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });

  try {
    const body = await request.json();
    const data = bodySchema.parse(body);

    const coTenant = await prisma.coTenant.create({
      data: { tenancyId: id, ...data },
    });

    return NextResponse.json(coTenant, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    return NextResponse.json({ error: 'Failed to add co-tenant' }, { status: 500 });
  }
}
