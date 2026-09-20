// GET /api/cron/expire-tenancies
// Transitions ACTIVE tenancies whose endDate has passed to EXPIRED,
// and sends TENANCY_ENDING_SOON notifications 30 and 7 days before end.
//
// Protect with CRON_SECRET so only the scheduler (e.g. Vercel Cron) can call it:
//   Authorization: Bearer <CRON_SECRET>
//
// Example vercel.json cron entry:
//   { "path": "/api/cron/expire-tenancies", "schedule": "0 1 * * *" }
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { sendTenancyEndingSoonEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const now = new Date();

  // 1. Expire tenancies whose endDate has passed
  const expired = await prisma.tenancy.updateMany({
    where: { status: 'ACTIVE', endDate: { lt: now } },
    data: { status: 'EXPIRED' },
  });

  // 2. TENANCY_ENDING_SOON — notify 30 days before end (FEAT-10)
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);
  const in29Days = new Date(now);
  in29Days.setDate(in29Days.getDate() + 29);

  const tenancyEndingSelect = {
    id: true,
    tenantId: true,
    room: {
      select: {
        property: {
          select: {
            landlordId: true,
            address: true,
          },
        },
      },
    },
    tenant: { select: { name: true, email: true } },
  } as const;

  const ending30 = await prisma.tenancy.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: in29Days, lt: in30Days },
    },
    select: tenancyEndingSelect,
  });

  // 3. TENANCY_ENDING_SOON — notify 7 days before end (FEAT-10)
  const in7Days = new Date(now);
  in7Days.setDate(in7Days.getDate() + 7);
  const in6Days = new Date(now);
  in6Days.setDate(in6Days.getDate() + 6);

  const ending7 = await prisma.tenancy.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: in6Days, lt: in7Days },
    },
    select: tenancyEndingSelect,
  });

  const notifyPromises: Promise<unknown>[] = [];

  for (const t of ending30) {
    const landlordId = t.room.property.landlordId;
    const address = t.room.property.address;
    const landlordUser = await prisma.user.findUnique({
      where: { id: landlordId },
      select: { name: true, email: true },
    });
    notifyPromises.push(
      createNotification(landlordId, 'TENANCY_ENDING_SOON', 'Tenancy ending in 30 days',
        'A tenancy you manage is ending in 30 days. Consider offering a renewal.',
        `/dashboard/landlord/tenancies/${t.id}/renew`),
      createNotification(t.tenantId, 'TENANCY_ENDING_SOON', 'Your tenancy ends in 30 days',
        'Your tenancy is ending in 30 days. Contact your landlord about renewal.',
        '/dashboard/tenant/tenancy'),
    );
    if (landlordUser) {
      notifyPromises.push(
        sendTenancyEndingSoonEmail(landlordUser.email, landlordUser.name, address, 30,
          `${process.env.NEXTAUTH_URL}/dashboard/landlord/tenancies/${t.id}/renew`),
      );
    }
    notifyPromises.push(
      sendTenancyEndingSoonEmail(t.tenant.email, t.tenant.name, address, 30,
        `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy`),
    );
  }

  for (const t of ending7) {
    const landlordId = t.room.property.landlordId;
    const address = t.room.property.address;
    const landlordUser = await prisma.user.findUnique({
      where: { id: landlordId },
      select: { name: true, email: true },
    });
    notifyPromises.push(
      createNotification(landlordId, 'TENANCY_ENDING_SOON', 'Tenancy ending in 7 days',
        'A tenancy you manage is ending in 7 days. Please prepare for move-out.',
        `/dashboard/landlord/tenancies/${t.id}`),
      createNotification(t.tenantId, 'TENANCY_ENDING_SOON', 'Your tenancy ends in 7 days',
        'Your tenancy is ending in 7 days. Please prepare for move-out.',
        '/dashboard/tenant/tenancy'),
    );
    if (landlordUser) {
      notifyPromises.push(
        sendTenancyEndingSoonEmail(landlordUser.email, landlordUser.name, address, 7,
          `${process.env.NEXTAUTH_URL}/dashboard/landlord/tenancies/${t.id}`),
      );
    }
    notifyPromises.push(
      sendTenancyEndingSoonEmail(t.tenant.email, t.tenant.name, address, 7,
        `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy`),
    );
  }

  await Promise.allSettled(notifyPromises);

  return NextResponse.json({
    expired: expired.count,
    notified30Days: ending30.length,
    notified7Days: ending7.length,
  });
}
