import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyJudgeCommand, newJudgeSession, type DemoRole, type JudgeSession, type Scenario } from './judge-demo';

const TOKEN = /^rle_demo_[A-Za-z0-9_-]{43}$/;
const roles: DemoRole[] = ['TENANT', 'LANDLORD'];

// One loopback process, isolated from .companion-data and every database. New
// scenarios create a new file; they never replace or delete a previous history.
export class JudgeStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {}
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined); return result;
  }
  private path(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid demo session.'); return join(this.directory, id + '.json');
  }
  // Token index files live in a separate folder, named by the token's hash.
  private tokenPath(token: string) {
    return join(this.directory, 'mcp-tokens', createHash('sha256').update(token).digest('hex') + '.json');
  }
  private async load(id: string): Promise<JudgeSession> {
    const state = JSON.parse(await readFile(this.path(id), 'utf8')) as JudgeSession;
    if (state.schema !== 1 || state.expiresAt <= Date.now() || state.records.tenancyId !== 'judge-synthetic-tenancy') throw new Error('Demo session unavailable.');
    return state;
  }
  private async write(path: string, value: unknown) {
    const temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, path);
  }
  private async save(id: string, session: JudgeSession) {
    await mkdir(this.directory, { recursive: true });
    await this.write(this.path(id), session);
  }
  private async index(id: string, tokens: Record<DemoRole, string>) {
    await mkdir(join(this.directory, 'mcp-tokens'), { recursive: true });
    for (const role of roles) await this.write(this.tokenPath(tokens[role]), { id, role });
  }
  read(id: string) { return this.exclusive(() => this.load(id)); }
  // A new scenario keeps the browser's MCP tokens, so connected clients follow the current case.
  create(scenario: Scenario = 'STANDARD', previousId?: string) {
    return this.exclusive(async () => {
      const id = randomBytes(32).toString('hex'), session = newJudgeSession(scenario);
      let previous: JudgeSession | null = null;
      if (previousId) try { previous = await this.load(previousId); } catch { previous = null; }
      if (previous?.mcp && previousId) {
        session.mcp = previous.mcp; delete previous.mcp;
        await this.save(id, session); await this.index(id, session.mcp); await this.save(previousId, previous);
      } else await this.save(id, session);
      return { id, session };
    });
  }
  execute(id: string, operation: string, input: unknown) {
    return this.exclusive(async () => {
      const session = applyJudgeCommand(await this.load(id), operation, input);
      await this.save(id, session); return session;
    });
  }
  // Server-only state changes, such as recording an assistant answer. Never route client input here directly.
  mutate(id: string, change: (session: JudgeSession) => JudgeSession) {
    return this.exclusive(async () => {
      const session = change(await this.load(id));
      await this.save(id, session); return session;
    });
  }
  mcpConnection(id: string) {
    return this.exclusive(async () => {
      const session = await this.load(id);
      if (!session.mcp) {
        session.mcp = { TENANT: newToken(), LANDLORD: newToken() };
        await this.index(id, session.mcp); await this.save(id, session);
      }
      return session.mcp;
    });
  }
  // Returns the case and role a bearer token was issued for, or null. Tokens grant
  // the read-only MCP tools only; confirmation still needs the browser session.
  resolveMcpToken(token: string) {
    return this.exclusive(async (): Promise<{ id: string; role: DemoRole } | null> => {
      if (!TOKEN.test(token)) return null;
      try {
        const entry = JSON.parse(await readFile(this.tokenPath(token), 'utf8')) as { id: string; role: DemoRole };
        if (!roles.includes(entry.role)) return null;
        const issued = (await this.load(entry.id)).mcp?.[entry.role];
        if (!issued || issued.length !== token.length || !timingSafeEqual(Buffer.from(issued), Buffer.from(token))) return null;
        return { id: entry.id, role: entry.role };
      } catch { return null; }
    });
  }
}

function newToken() { return 'rle_demo_' + randomBytes(32).toString('base64url'); }
