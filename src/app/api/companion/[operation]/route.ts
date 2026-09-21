import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { CompanionError, parseCommand, SessionStore, snapshot } from '@/lib/companion/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'rentalease_demo_session';
const globalStore = globalThis as unknown as { companionStore?: SessionStore; companionInFlight?: Set<string> };
// Replace stale method closures after a development hot reload; retain one instance otherwise.
const store = globalStore.companionStore instanceof SessionStore ? globalStore.companionStore
  : (globalStore.companionStore = new SessionStore(join(process.cwd(), '.companion-data')));
const inFlight = globalStore.companionInFlight ??= new Set<string>();
type RouteContext = { params: Promise<{ operation: string }> };

function guard(request: NextRequest, write: boolean) {
  if (process.env.COMPANION_OFFLINE_DEMO !== '1') throw new CompanionError(404, 'The local demo service is not enabled.');
  const host = request.headers.get('host') ?? '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) throw new CompanionError(403, 'The demo service is loopback-only.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new CompanionError(403, 'Cross-site requests are not allowed.');
  const origin = request.headers.get('origin');
  if ((write || origin) && origin !== `http://${host}`) throw new CompanionError(403, 'A same-origin request is required.');
}
function response(session: Parameters<typeof snapshot>[0], notice?: string) {
  return NextResponse.json({ ...snapshot(session), configuredProvider: process.env.COMPANION_OLLAMA_MODEL ? 'ollama' : 'rules', notice }, { headers: { 'Cache-Control': 'no-store' } });
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof CompanionError ? error.message : 'The local demo could not save your request. Please try again.' }, { status: error instanceof CompanionError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
async function body(request: NextRequest): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new CompanionError(415, 'Send JSON.');
  const reader = request.body?.getReader();
  if (!reader) throw new CompanionError(400, 'Missing request body.');
  let bytes = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); throw new CompanionError(413, 'Request is too large.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new CompanionError(400, 'Invalid JSON.'); }
}
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    guard(request, false);
    if ((await context.params).operation !== 'session') throw new CompanionError(404, 'Unknown operation.');
    const id = request.cookies.get(COOKIE)?.value;
    if (id) {
      try { return response(await store.read(id)); }
      catch (error) { if (!(error instanceof CompanionError && error.status === 401)) throw error; }
    }
    const created = await store.create(); const result = response(created.session);
    result.cookies.set(COOKIE, created.id, { httpOnly: true, sameSite: 'strict', path: '/api/companion', maxAge: 7 * 86400 });
    return result;
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, context: RouteContext) {
  let lockedId: string | undefined;
  try {
    guard(request, true);
    const id = request.cookies.get(COOKIE)?.value;
    if (!id) throw new CompanionError(401, 'Reload to start a demo session.');
    const operation = (await context.params).operation;
    if (inFlight.has(id)) throw new CompanionError(429, 'A request is already running. Please wait for it to finish.');
    inFlight.add(id); lockedId = id;
    if (operation === 'resume') return response(await store.resume(id));
    const command = parseCommand(operation, await body(request));
    const result = await store.execute(id, command, { model: process.env.COMPANION_OLLAMA_MODEL });
    return response(result.session, result.notice);
  } catch (error) { return failure(error); }
  finally { if (lockedId) inFlight.delete(lockedId); }
}
