import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { retrieveTenancyRecords } from '@/lib/companion/database';
import { generateRecordAnswer } from '@/lib/companion/records-model';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, context: { params: Promise<{ tenancyId: string }> }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.COMPANION_RECORDS_MODE !== '1') return new NextResponse(null, { status: 404 });
  try {
    const session = await getServerSession(recordsAuthOptions);
    if (!session?.user.id) return NextResponse.json({ error: 'Sign in to view records.' }, { status: 401, headers });
    // Stream with a hard byte limit, including chunked requests without Content-Length.
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required.' }, { status: 415, headers });
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Question required.' }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return NextResponse.json({ error: 'Question too large.' }, { status: 413, headers }); }
      chunks.push(value);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers }); }
    if (!input || typeof input.question !== 'string' || !input.question.trim() || input.question.length > 600 || Object.keys(input).some(k => k !== 'question')) return NextResponse.json({ error: 'Send only a question of 1–600 characters.' }, { status: 400, headers });
    const { tenancyId } = await context.params;
    const records = await retrieveTenancyRecords(recordsDb(), session.user.id, tenancyId);
    let retrievedAt = new Date().toISOString();
    let answer = await generateRecordAnswer(records, input.question, { model: process.env.RECORDS_LOCAL_MODEL });
    // Inference can take seconds: recheck access before returning any source text.
    const rechecked = await getServerSession(recordsAuthOptions);
    if (rechecked?.user.id !== session.user.id) return NextResponse.json({ error: 'Sign in to view records.' }, { status: 401, headers });
    const current = await retrieveTenancyRecords(recordsDb(), session.user.id, tenancyId);
    if (JSON.stringify(current) !== JSON.stringify(records)) {
      answer = { ...await generateRecordAnswer(current, input.question), notice: 'Records changed during source selection. Showing a fresh rule-based response.' };
      retrievedAt = new Date().toISOString();
    }
    return NextResponse.json({ answer, retrievedAt }, { headers });
  } catch (error) {
    const denied = error instanceof Error && error.message === 'Tenancy unavailable.';
    return NextResponse.json({ error: denied ? 'Tenancy unavailable.' : 'Records temporarily unavailable.' }, { status: denied ? 404 : 503, headers });
  }
}
