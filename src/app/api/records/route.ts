import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { listAuthorizedTenancies } from '@/lib/companion/database';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (process.env.COMPANION_RECORDS_MODE !== '1') return new NextResponse(null, { status: 404 });
  try {
    const session = await getServerSession(recordsAuthOptions);
    if (!session?.user.id) return NextResponse.json({ error: 'Sign in to view records.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(await listAuthorizedTenancies(recordsDb(), session.user.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Records temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
