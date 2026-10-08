import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runAssistant, type Converse } from './assistant';
import { bedrockConverse, bedrockSettings, type BedrockSettings } from './bedrock';
import { applyJudgeCommand, recordAssistantTurn, type DemoRole, type JudgeSession } from './judge-demo';
import { JUDGE_PROFILE, judgeActor, judgeMcpServices } from './judge-mcp';
import type { JudgeStore } from './judge-store';
import { createRecordsMcpServer } from './mcp-server';
import { normalizeSpokenQuestion } from './voice';

// Process-local cost guard for a single-user local demo, not a billing control.
const LIMIT = { concurrent: 2, perCase: 40, windowMs: 3600000 };
let running = 0;
const usage = new Map<string, number[]>();
function reserve(id: string, now = Date.now()) {
  const recent = (usage.get(id) ?? []).filter(time => now - time < LIMIT.windowMs);
  if (running >= LIMIT.concurrent || recent.length >= LIMIT.perCase) return false;
  usage.set(id, [...recent, now]); running++;
  return true;
}

export function assistantMode(env: Record<string, string | undefined> = process.env) {
  try {
    const settings = bedrockSettings(env);
    return settings ? { mode: 'bedrock' as const, model: settings.modelId } : { mode: 'rules' as const };
  } catch { return { mode: 'rules' as const }; }
}

function parseInput(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (Object.keys(input).some(key => !['revision', 'question'].includes(key)) || !Number.isSafeInteger(input.revision) || typeof input.question !== 'string')
    throw new Error('Unsupported command or field.');
  // Reject overlong input rather than silently truncating what the person said.
  const question = input.question.length > 600 ? '' : normalizeSpokenQuestion(input.question);
  if (!question) throw new Error('Use a question of 1–600 characters.');
  return { revision: input.revision as number, question };
}

// Answers one typed or spoken question. With Bedrock configured the model reads the
// case only through the RentalEase MCP tools; otherwise, or on any failure, the
// deterministic rule assistant answers and the page says so.
export async function assistantTurn(store: JudgeStore, id: string, value: unknown,
  deps: { settings?: BedrockSettings | null; converse?: Converse; timeoutMs?: number } = {}): Promise<JudgeSession> {
  const { revision, question } = parseInput(value);
  const settings = deps.settings === undefined ? bedrockSettings() : deps.settings;
  const rules = (notice?: string) => store.mutate(id, session => {
    const next = applyJudgeCommand(session, 'chat', { revision, question });
    if (notice) next.notice = notice + ' ' + next.notice;
    return next;
  });
  if (!settings) return rules();
  const before = await store.read(id);
  if (before.revision !== revision) throw new Error('This demo changed in another tab. Reload and review the latest state.');
  if (!reserve(id)) return rules('The AI assistant is busy or has reached this case’s hourly limit, so the rule assistant answered.');
  const role = before.records.role as DemoRole;
  let server: ReturnType<typeof createRecordsMcpServer> | undefined, client: Client | undefined;
  try {
    server = createRecordsMcpServer(judgeActor(id, role), judgeMcpServices(store), { preview: true }, JUDGE_PROFILE);
    client = new Client({ name: 'rentalease-voice-assistant', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const converse = deps.converse ?? await bedrockConverse(settings);
    const history = before.messages.filter(message => message.role === role).slice(-3).map(m => ({ question: m.question, text: m.text }));
    const result = await runAssistant({ converse, modelId: settings.modelId, client, records: { ...before.records, role }, selected: before.selected,
      question, history, signal: AbortSignal.timeout(deps.timeoutMs ?? 30000) });
    return await store.mutate(id, session => recordAssistantTurn(session, revision, { question, model: settings.modelId, ...result }));
  } catch (error) {
    if (error instanceof Error && /changed in another tab/.test(error.message)) throw error;
    // Log the error class for the developer; the page gets a plain-language notice.
    console.warn('[rentalease] Bedrock assistant unavailable:', error instanceof Error ? error.name + ': ' + error.message : error);
    return rules('Amazon Bedrock was unavailable, so the rule assistant answered.');
  } finally {
    running--;
    await client?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  }
}
