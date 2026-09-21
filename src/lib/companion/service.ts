import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { actors, confirmAction, getEvidence, getSettlementContext, initialState, prepareAction, type DemoState, type Role } from './demo';
import { generateReply, type ProviderConfig } from './provider';

export class CompanionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Session = { schema: 1; revision: number; role: Role; state: DemoState; expiresAt: number; pendingUntil: number };
export type Command =
  | { operation: 'role'; revision: number; role: Role }
  | { operation: 'reset'; revision: number; baseline: DemoState['baseline'] }
  | { operation: 'prepare'; revision: number; kind: 'DISPUTE' | 'WITHDRAW' }
  | { operation: 'confirm'; revision: number; actionId: string }
  | { operation: 'cancel'; revision: number }
  | { operation: 'chat'; revision: number; question: string };

export function parseCommand(operation: string, value: unknown): Command {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CompanionError(400, 'Expected a JSON object.');
  const input = value as Record<string, unknown>;
  const revision = input.revision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) throw new CompanionError(400, 'A valid session revision is required.');
  const fields: Record<string, string[]> = { role: ['role'], reset: ['baseline'], prepare: ['kind'], confirm: ['actionId'], cancel: [], chat: ['question'] };
  if (!Object.prototype.hasOwnProperty.call(fields, operation) || Object.keys(input).some(key => key !== 'revision' && !fields[operation].includes(key))) throw new CompanionError(400, 'Unsupported operation or field.');
  if (operation === 'role' && (input.role === 'TENANT' || input.role === 'LANDLORD')) return { operation, revision, role: input.role };
  if (operation === 'reset' && (input.baseline === 'ACCEPTED' || input.baseline === 'DISPUTED' || input.baseline === 'MISSING')) return { operation, revision, baseline: input.baseline };
  if (operation === 'prepare' && (input.kind === 'DISPUTE' || input.kind === 'WITHDRAW')) return { operation, revision, kind: input.kind };
  if (operation === 'confirm' && typeof input.actionId === 'string' && /^[a-f0-9-]{36}$/.test(input.actionId)) return { operation, revision, actionId: input.actionId };
  if (operation === 'cancel') return { operation, revision };
  if (operation === 'chat' && typeof input.question === 'string' && input.question.trim().length > 0 && input.question.length <= 1000) return { operation, revision, question: input.question.trim() };
  throw new CompanionError(400, 'Invalid command values.');
}

export function snapshot(session: Session) {
  const actor = actors[session.role];
  return { revision: session.revision, role: session.role, state: { ...session.state,
    pending: session.pendingUntil > Date.now() ? session.state.pending : null,
    entries: session.state.entries.filter(entry => entry.role === session.role),
    receipts: [] },
    evidence: getEvidence(actor, 'demo-tenancy-01', session.state),
    settlement: getSettlementContext(actor, 'demo-tenancy-01', session.state) };
}

// A single-process local demo store, not production authentication or a database.
// All operations are serialized, including revision checks and atomic file replacement.
export class SessionStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private directory: string) {}
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private path(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new CompanionError(401, 'Start a new demo session.');
    return join(this.directory, `${id}.json`);
  }
  private async load(id: string): Promise<Session> {
    const path = this.path(id);
    let session: Session;
    try { session = JSON.parse(await readFile(path, 'utf8')) as Session; }
    catch { throw new CompanionError(401, 'Your demo session is unavailable. Reload to start again.'); }
    if (session.schema !== 1 || !session.expiresAt || session.expiresAt < Date.now()) throw new CompanionError(401, 'Your demo session expired. Reload to start again.');
    return session;
  }
  private async save(id: string, session: Session) {
    await mkdir(this.directory, { recursive: true });
    const path = this.path(id);
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(session), { mode: 0o600 });
    await rename(temporary, path);
  }
  create() {
    return this.exclusive(async () => {
      const id = randomBytes(32).toString('hex');
      const session: Session = { schema: 1, revision: 0, role: 'TENANT', state: initialState(), expiresAt: Date.now() + 7 * 86400000, pendingUntil: 0 };
      await this.save(id, session);
      return { id, session };
    });
  }
  read(id: string) { return this.exclusive(() => this.load(id)); }
  resume(id: string) {
    return this.exclusive(async () => {
      const session = await this.load(id);
      if (session.state.pending) {
        session.state.pending = null; session.pendingUntil = 0; session.revision++;
        await this.save(id, session);
      }
      return session;
    });
  }
  async execute(id: string, command: Command, config: ProviderConfig) {
    // Inference happens outside the write lock. Re-read the session before committing.
    const before = await this.read(id);
    if (command.revision !== before.revision && !(command.operation === 'confirm' && before.state.receipts.includes(`${actors[before.role].id}:${command.actionId}`))) throw new CompanionError(409, 'This session changed in another tab. Refresh and review the latest state.');
    const reply = command.operation === 'chat' ? await generateReply(actors[before.role], before.state, command.question, config) : undefined;
    return this.exclusive(async () => {
      const session = await this.load(id);
      const actor = actors[session.role];
      if (command.operation === 'confirm' && session.state.receipts.includes(`${actor.id}:${command.actionId}`)) return { session };
      if (command.revision !== session.revision) throw new CompanionError(409, 'This session changed while processing. Refresh and try again.');
      try {
        switch (command.operation) {
          case 'role': session.role = command.role; session.state.pending = null; session.pendingUntil = 0; break;
          case 'reset': session.state = initialState(command.baseline); session.role = 'TENANT'; session.pendingUntil = 0; break;
          case 'prepare': session.state = prepareAction(session.state, actor, command.kind, randomUUID()); session.pendingUntil = Date.now() + 300000; break;
          case 'confirm':
            if (session.pendingUntil <= Date.now()) throw new CompanionError(409, 'The confirmation expired. Prepare a new draft.');
            session.state = confirmAction(session.state, actor, command.actionId); session.pendingUntil = 0; break;
          case 'cancel': session.state.pending = null; session.pendingUntil = 0; break;
          case 'chat':
            if (!reply) throw new Error('No assistant response.');
            // A model can never submit or confirm a business action.
            session.state.pending = null; session.pendingUntil = 0;
            session.state.entries = [...session.state.entries,
              { id: randomUUID(), role: session.role, speaker: 'USER', text: command.question, sourceIds: [] },
              { id: randomUUID(), role: session.role, speaker: 'ASSISTANT', text: reply.text, sourceIds: reply.sourceIds, provider: reply.provider },
            ].slice(-100) as DemoState['entries'];
            break;
        }
      } catch (error) {
        if (error instanceof CompanionError) throw error;
        throw new CompanionError(409, error instanceof Error ? error.message : 'The action is not available.');
      }
      session.revision++;
      await this.save(id, session);
      return { session, notice: reply?.notice };
    });
  }
}
