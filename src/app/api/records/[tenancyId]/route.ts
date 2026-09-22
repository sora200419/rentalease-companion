import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { retrieveTenancyRecords, recordEvidenceAnswer } from '@/lib/companion/database';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ tenancyId: string }> }) {
  if (process.env.COMPANION_RECORDS_MODE !== '1') return new NextResponse(null, { status: 404 });
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const session = await getServerSession(recordsAuthOptions);
    if (!session?.user.id) return NextResponse.json({ error: 'Sign in to view records.' }, { status: 401, headers });
    const { tenancyId } = await context.params;
    const records = await retrieveTenancyRecords(recordsDb(), session.user.id, tenancyId);
    return NextResponse.json({ records, answer: recordEvidenceAnswer(records) }, { headers });
  } catch (error) {
    const denied = error instanceof Error && error.message === 'Tenancy unavailable.';
    return NextResponse.json({ error: denied ? 'Tenancy unavailable.' : 'Records temporarily unavailable.' }, { status: denied ? 404 : 503, headers });
  }
}
