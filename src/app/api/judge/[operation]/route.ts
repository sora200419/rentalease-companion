import { NextRequest, NextResponse } from 'next/server';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { JudgeStore } from '@/lib/companion/judge-store';
import { judgeSnapshot, photoFiles, type JudgeSession } from '@/lib/companion/judge-demo';
import { readMcpMessage, McpBodyError } from '@/lib/companion/mcp-body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'rentalease_judge_demo';
const globals = globalThis as unknown as { judgeStore?: JudgeStore };
const store = globals.judgeStore instanceof JudgeStore ? globals.judgeStore
  : (globals.judgeStore = new JudgeStore(join(process.cwd(), '.local-runtime', 'judge-sessions')));
type Context = { params: Promise<{ operation: string }> };
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
class RouteError extends Error { constructor(public status: number, message: string) { super(message); } }
function guard(request: NextRequest, write: boolean) {
  if (process.env.COMPANION_OFFLINE_DEMO !== '1' || process.env.COMPANION_RECORDS_MODE === '1') throw new RouteError(404, 'Standalone demo is disabled.');
  if (request.headers.get('host') !== '127.0.0.1:3030' || request.headers.get('sec-fetch-site') === 'cross-site') throw new RouteError(403, 'Local demo access only.');
  const origin = request.headers.get('origin');
  if ((write || origin) && origin !== 'http://127.0.0.1:3030') throw new RouteError(403, 'Same-origin request required.');
  if (request.headers.has('authorization')) throw new RouteError(400, 'No cloud credentials are used by this demo.');
}
function respond(session: JudgeSession) { return NextResponse.json(judgeSnapshot(session), { headers }); }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error && !('code' in error) ? error.message : 'Demo session unavailable. Start a new scenario or retry.' },
    { status: error instanceof RouteError || error instanceof McpBodyError ? error.status : 409, headers });
}
function attach(result: NextResponse, id: string) {
  result.cookies.set(COOKIE, id, { httpOnly: true, sameSite: 'strict', path: '/api/judge', maxAge: 7 * 86400 });
  return result;
}
export async function GET(request: NextRequest, context: Context) {
  try {
    guard(request, false);
    const operation = (await context.params).operation, id = request.cookies.get(COOKIE)?.value;
    if (operation === 'session') {
      if (id) return respond(await store.read(id));
      const created = await store.create(); return attach(respond(created.session), created.id);
    }
    if (operation === 'photo') {
      if (!id) throw new RouteError(401, 'Start a demo session first.');
      const session = await store.read(id), photoId = request.nextUrl.searchParams.get('id') ?? '';
      if (!judgeSnapshot(session).photos.some(p => p.id === photoId) || !Object.hasOwn(photoFiles, photoId)) throw new RouteError(404, 'Photo unavailable in this scenario.');
      const file = photoFiles[photoId as keyof typeof photoFiles];
      const bytes = await readFile(join(process.cwd(), 'demo-assets', 'evidence', file));
      return new NextResponse(bytes, { headers: { ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'inline; filename="' + file + '"' } });
    }
    throw new RouteError(404, 'Unknown demo endpoint.');
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    guard(request, true);
    const operation = (await context.params).operation;
    const body = await readMcpMessage(request);
    if (operation === 'start') {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'confirmed,scenario') throw new RouteError(400, 'Confirm a scenario first.');
      const input = body as Record<string, unknown>;
      if (input.confirmed !== true || !['STANDARD', 'MISSING', 'CONFLICTING'].includes(String(input.scenario))) throw new RouteError(400, 'Invalid scenario confirmation.');
      const created = await store.create(input.scenario as JudgeSession['scenario']); return attach(respond(created.session), created.id);
    }
    const id = request.cookies.get(COOKIE)?.value;
    if (!id) throw new RouteError(401, 'Start a demo session first.');
    return respond(await store.execute(id, operation, body));
  } catch (error) { return failure(error); }
}
