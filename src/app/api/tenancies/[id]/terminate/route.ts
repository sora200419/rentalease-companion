// POST /api/tenancies/[id]/terminate
// Serve a formal notice to terminate. Landlord or tenant can call this.
// Immediately marks tenancy as TERMINATED with a reason and timestamp.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { z } from 'zod';
import { validateImmediateTerminationDate } from '@/lib/tenancyLifecycle';

const terminateSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason (at least 10 characters)'),
  terminationDate: z.string().datetime().optional(), // defaults to now
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      status: { in: ['ACTIVE', 'EXPIRED'] },
      ...(session.user.role === 'LANDLORD'
        ? { room: { property: { landlordId: session.user.id } } }
        : { tenantId: session.user.id }),
    },
    select: {
      id: true,
      tenantId: true,
      roomId: true,
      room: { select: { property: { select: { landlordId: true } } } },
    },
  });

  if (!tenancy) return NextResponse.json({ error: 'Tenancy not found or already terminated' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = terminateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const at = parsed.data.terminationDate ? new Date(parsed.data.terminationDate) : new Date();
  const validationError = validateImmediateTerminationDate(at);
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 });

  await prisma.$transaction([
    prisma.tenancy.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminatedAt: at,
        terminatedReason: parsed.data.reason,
      },
    }),
    prisma.rentPayment.updateMany({
      where: {
        tenancyId: id,
        status: 'PENDING',
        dueDate: { gt: at },
      },
      data: {
        status: 'WAIVED',
        notes:
          'Automatically waived because the tenancy was terminated before this rent due date.',
      },
    }),
    prisma.room.update({
      where: { id: tenancy.roomId },
      data: { isAvailable: true },
    }),
  ]);

  // Notify the other party (non-blocking)
  const isLandlord = session.user.role === 'LANDLORD';
  const notifyUserId = isLandlord
    ? tenancy.tenantId
    : tenancy.room.property.landlordId;
  const notifyTitle = isLandlord
    ? 'Landlord has served notice to quit'
    : 'Tenant has served notice to quit';
  const notifyBody = isLandlord
    ? `Your landlord has served a formal notice to terminate the tenancy. Reason: ${parsed.data.reason}`
    : `Your tenant has served a formal notice to terminate the tenancy. Reason: ${parsed.data.reason}`;

  createNotification(
    notifyUserId,
    'MUTUAL_TERMINATION_RESPONDED',
    notifyTitle,
    notifyBody,
    isLandlord
      ? `/dashboard/tenant/tenancy`
      : `/dashboard/landlord/tenancies/${id}`,
  );

  return NextResponse.json({ message: 'Tenancy terminated' });
}
