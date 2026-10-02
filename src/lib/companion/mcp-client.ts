import { callLocalMcpTool } from './mcp-connection';
import type { answerRecordQuestion } from './records-questions';
import type { ActionInput } from './records-actions';
import type { previewMcpAction } from './mcp-server';

// The browser owns its existing HttpOnly session. Credentials never become tool arguments.
const callTool = (name: string, args: Record<string, unknown>) => callLocalMcpTool(name, args, window.location.origin);

export async function askMcpRecords(tenancyId: string, question: string, deductionId?: string) {
  const data = await callTool('ask_records', { tenancyId, question, ...(deductionId ? { deductionId } : {}) });
  if (data.tenancyId !== tenancyId || !Number.isSafeInteger(data.revision) || !data.answer || typeof data.answer !== 'object')
    throw new Error('The response could not be verified. Refresh access and retry.');
  return data as { tenancyId: string; revision: number; answer: ReturnType<typeof answerRecordQuestion> };
}

export async function previewThroughMcp(tenancyId: string, expectedRevision: number, action: ActionInput) {
  const data = await callTool('prepare_dispute_action', { tenancyId, expectedRevision, action });
  if (data.tenancyId !== tenancyId || data.revision !== expectedRevision || data.saved !== false)
    throw new Error('Records changed. Refresh the tenancy and review again.');
  return data as ReturnType<typeof previewMcpAction>;
}
