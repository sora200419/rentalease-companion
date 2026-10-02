import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { retrieveTenancyRecords } from '@/lib/companion/database';
import { parseAction, validateAction, prepareActionToken, verifyActionToken } from '@/lib/companion/records-actions';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ tenancyId: string }> }) {
  const headers = { 'Cache-Control': 'no-store' };
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
  if (process.env.COMPANION_RECORDS_MODE !== '1') return fail('Unavailable.',404);
  if (request.headers.get('origin') !== 'http://127.0.0.1:3031') return fail('Same-origin request required.',403);
  try {
    const session = await getServerSession(recordsAuthOptions);
    if (!session?.user.id) return fail('Sign in before submitting.',401);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('JSON required.',415);
    const reader = request.body?.getReader(); if (!reader) return fail('Submission required.',400);
    const chunks: Uint8Array[] = []; let size=0;
    while (true) { const { done,value } = await reader.read(); if (done) break; size+=value.byteLength; if (size>18000) { await reader.cancel(); return fail('Submission too large.',413); } chunks.push(value); }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail('Invalid JSON.',400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('Invalid submission.',400);
    const { tenancyId } = await context.params;
    const records = await retrieveTenancyRecords(recordsDb(),session.user.id,tenancyId);
    const secret = process.env.NEXTAUTH_SECRET ?? '';
    if (input.operation === 'prepare') {
      if (Object.keys(input).some(k => !['operation','action'].includes(k))) return fail('Unexpected fields.',400);
      try {
        const action = parseAction(input.action); validateAction(records,action);
        return NextResponse.json(prepareActionToken(action,session.user.id,tenancyId,records.revision,secret),{headers});
      } catch { return fail('Check the content, role and current record status.',400); }
    }
    if (input.operation !== 'confirm' || input.confirmed !== true || typeof input.token !== 'string' || Object.keys(input).some(k => !['operation','confirmed','token'].includes(k))) return fail('Explicit confirmation required.',400);
    let prepared;
    try { prepared = verifyActionToken(input.token,session.user.id,tenancyId,secret); } catch { return fail('Confirmation expired or invalid. Check history before reviewing again.',409); }
    // The function checks role, current state, fixture scope and revision atomically.
    // Replay is checked before transitions so a lost response can be retried safely.
    const rows = await recordsDb().$queryRaw<{ result: { id: string; revision: number; replayed: boolean } }[]>`SELECT public.records_submit(${session.user.id},${tenancyId},${prepared.id},${prepared.revision}::integer,${prepared.kind},${JSON.stringify(prepared.payload)}::jsonb) AS result`;
    return NextResponse.json({ receipt: rows[0].result },{headers});
  } catch (error) {
    const e = error as { message?: string; meta?: { message?: string } };
    const message = e.meta?.message ?? e.message ?? '';
    if (/TENANCY_UNAVAILABLE|Tenancy unavailable/.test(message)) return fail('Tenancy unavailable.',404);
    if (/STALE_REVISION|INVALID_TRANSITION|REPLAY_MISMATCH|ROLE_DENIED|INVALID_SUBMISSION|AMOUNT_MISMATCH/.test(message)) return fail('Records changed, amounts need review, or action unavailable. Refresh and review again.',409);
    return fail('Could not verify submission result. Retry the same confirmation; do not create a new submission yet.',503);
  }
}
