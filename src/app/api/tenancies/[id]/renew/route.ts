// POST /api/tenancies/[id]/renew
// Landlord creates a renewal tenancy for the same room and tenant,
// linked via renewalOfTenancyId. The new tenancy starts in INVITED state
// so the tenant must re-accept before an agreement is drafted.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';
import { validateRenewalPeriod } from '@/lib/tenancyLifecycle';

const renewSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  monthlyRent: z.number().positive(),
  depositAmount: z.number().min(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      room: { property: { landlordId: session.user.id } },
      status: { in: ['ACTIVE', 'EXPIRED'] },
    },
    select: { id: true, roomId: true, tenantId: true, endDate: true },
  });

  if (!tenancy) return NextResponse.json({ error: 'Tenancy not found or not eligible for renewal' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = renewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { startDate, endDate, monthlyRent, depositAmount } = parsed.data;

  const validationError = validateRenewalPeriod({
    currentEndDate: tenancy.endDate,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 });

  const [renewal] = await prisma.$transaction([
    prisma.tenancy.create({
      data: {
        roomId: tenancy.roomId,
        tenantId: tenancy.tenantId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyRent,
        depositAmount,
        status: 'INVITED',
        renewalOfTenancyId: tenancy.id,
      },
      select: { id: true },
    }),
    prisma.room.update({
      where: { id: tenancy.roomId },
      data: { isAvailable: false },
    }),
  ]);

  // Notify tenant of renewal invitation (non-blocking)
  createNotification(
    tenancy.tenantId,
    'INVITATION_RECEIVED',
    'Tenancy renewal offer',
    'Your landlord has offered to renew your tenancy. Review the new terms and accept or decline.',
    `/dashboard/tenant/tenancy`,
  );

  return NextResponse.json({ tenancyId: renewal.id }, { status: 201 });
}
