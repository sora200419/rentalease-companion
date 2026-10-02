import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { retrieveTenancyRecords } from '@/lib/companion/database';
import { settlementSummaryText } from '@/lib/companion/records-summary';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ tenancyId: string }> }) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (process.env.COMPANION_RECORDS_MODE !== '1') return new NextResponse(null, { status: 404, headers });
  try {
    const session = await getServerSession(recordsAuthOptions);
    if (!session?.user.id) return NextResponse.json({ error: 'Sign in to view records.' }, { status: 401, headers });
    const { tenancyId } = await context.params;
    const records = await retrieveTenancyRecords(recordsDb(), session.user.id, tenancyId);
    return new NextResponse(settlementSummaryText(records, new Date().toISOString()), {
      headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rentalease-summary-r' + records.revision + '.txt"' },
    });
  } catch (error) {
    const denied = error instanceof Error && error.message === 'Tenancy unavailable.';
    return NextResponse.json({ error: denied ? 'Tenancy unavailable.' : 'Summary temporarily unavailable.' }, { status: denied ? 404 : 503, headers });
  }
}
