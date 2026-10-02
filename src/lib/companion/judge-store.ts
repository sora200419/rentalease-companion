import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyJudgeCommand, newJudgeSession, type JudgeSession, type Scenario } from './judge-demo';

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
  private async load(id: string): Promise<JudgeSession> {
    const state = JSON.parse(await readFile(this.path(id), 'utf8')) as JudgeSession;
    if (state.schema !== 1 || state.expiresAt <= Date.now() || state.records.tenancyId !== 'judge-synthetic-tenancy') throw new Error('Demo session unavailable.');
    return state;
  }
  private async save(id: string, session: JudgeSession) {
    await mkdir(this.directory, { recursive: true });
    const path = this.path(id), temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(session), { mode: 0o600 }); await rename(temporary, path);
  }
  read(id: string) { return this.exclusive(() => this.load(id)); }
  create(scenario: Scenario = 'STANDARD') {
    return this.exclusive(async () => {
      const id = randomBytes(32).toString('hex'), session = newJudgeSession(scenario);
      await this.save(id, session); return { id, session };
    });
  }
  execute(id: string, operation: string, input: unknown) {
    return this.exclusive(async () => {
      const session = applyJudgeCommand(await this.load(id), operation, input);
      await this.save(id, session); return session;
    });
  }
}
