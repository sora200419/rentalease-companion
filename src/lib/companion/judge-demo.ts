import { randomUUID } from 'node:crypto';
import { parseAction, validateWorkflowAction, type ActionInput } from './records-actions';
import { eventDeduction, money, revisedRefund, type Records } from './records-workflow';
import { labels, optionsFor, routeDialogue } from './records-dialogue';
import { answerDeductionQuestion } from './records-evidence';
import { speakable, spokenEvidence } from './voice';

export type Scenario = 'STANDARD' | 'MISSING' | 'CONFLICTING';
export type DemoRole = 'TENANT' | 'LANDLORD';
export const photoFiles = {
  W01: 'demo-wall-move-in-W01.png', W02: 'demo-wall-move-out-W02.png',
  K01: 'demo-kitchen-move-in-K01.png', K02: 'demo-kitchen-move-out-K02.png',
} as const;
export const photoIndex = [
  { id: 'W01', deductionId: 'wall', reportId: 'move-in', phase: 'Move-in', description: 'Bedroom window wall · synthetic baseline' },
  { id: 'W02', deductionId: 'wall', reportId: 'move-out', phase: 'Move-out', description: 'Bedroom window wall · synthetic comparison' },
  { id: 'K01', deductionId: 'cleaning', reportId: 'move-in', phase: 'Move-in', description: 'Kitchen counter · synthetic baseline' },
  { id: 'K02', deductionId: 'cleaning', reportId: 'move-out', phase: 'Move-out', description: 'Kitchen counter · synthetic comparison' },
] as const;
export type JudgeSession = {
  schema: 1; revision: number; expiresAt: number; scenario: Scenario; selected: string;
  records: Records;
  // origin marks previews drafted by the AI assistant, so the page can label them.
  pending: { id: string; revision: number; role: DemoRole; action: ActionInput; expiresAt: number; description: string; origin?: 'assistant' } | null;
  receipts: string[];
  messages: JudgeMessage[];
  notice: string;
  // Per-role bearer tokens for local MCP clients; never included in snapshots.
  mcp?: Record<DemoRole, string>;
};
export type JudgeMessage = {
  role: DemoRole; question: string; text: string; sourceIds: string[];
  speech?: string; provider?: 'rules' | 'bedrock'; model?: string; tools?: string[]; drafted?: boolean;
};
export type AssistantTurn = {
  question: string; text: string; speech: string; sourceIds: string[];
  model: string; tools: string[]; focus: string | null; draft: ActionInput | null;
};

export function newJudgeSession(scenario: Scenario = 'STANDARD'): JudgeSession {
  const records: Records = {
    tenancyId: 'judge-synthetic-tenancy', role: 'TENANT', revision: 0, depositSen: 180000, history: [],
    settlement: { id: 'demo-settlement', status: 'PROPOSED', recordedOriginalSen: 180000, recordedRefundSen: 162500, paymentRecorded: false,
      deductions: [
        { id: 'wall', reason: 'Bedroom wall repainting', amountSen: 10000, status: 'PROPOSED' },
        { id: 'cleaning', reason: 'Kitchen cleaning', amountSen: 5000, status: 'PROPOSED' },
        { id: 'key', reason: 'Replacement key', amountSen: 2500, status: 'PROPOSED' },
      ] },
    agreement: { id: 'clause-7', status: 'SIGNED', text: 'SYNTHETIC CLAUSE 7: Review proposed deductions against condition reports and supporting evidence. Consider pre-existing marks and normal wear. Parties must explicitly agree to a revised amount. This is demonstration text, not legal advice.' },
    evidence: [
      ...(scenario === 'MISSING' ? [] : [{ id: 'move-in', kind: 'MOVE_IN' as const, status: scenario === 'CONFLICTING' ? 'DISPUTED' as const : 'ACCEPTED' as const,
        text: 'SYNTHETIC MOVE-IN: A short scuff was recorded below the bedroom window. Kitchen counter recorded as clean. Two keys listed.',
        submittedAt: '2025-10-01T09:00:00.000Z' }]),
      { id: 'move-out', kind: 'MOVE_OUT', status: 'SUBMITTED',
        text: 'SYNTHETIC MOVE-OUT: Landlord reports a wall scuff, residue on the kitchen counter and one returned key. These claims await tenant review.',
        submittedAt: '2026-09-20T09:00:00.000Z' },
      ...(scenario === 'CONFLICTING' ? [{ id: 'tenant-account', kind: 'INSPECTION' as const, status: 'DISPUTED' as const,
        text: 'CONFLICTING SYNTHETIC ACCOUNT: Tenant says the kitchen was cleaned and both keys were returned. Landlord reports residue and a missing key. Neither account is treated as proven.',
        submittedAt: '2026-09-21T09:00:00.000Z' }] : []),
    ],
  };
  for (const photo of photoIndex.filter(p => records.evidence.some(r => r.id === p.reportId))) {
    records.history.push({ id: photo.id, actorId: 'synthetic-fixture', kind: 'EVIDENCE_LINK', revision: 0,
      createdAt: '2026-09-21T09:00:00.000Z',
      payload: { text: 'AI-GENERATED DEMO — NOT REAL EVIDENCE. ' + photo.description,
        deductionId: photo.deductionId, reportId: photo.reportId, fileKey: 'demo--asset--' + photoFiles[photo.id] } });
  }
  return { schema: 1, revision: 0, expiresAt: Date.now() + 7 * 86400000, scenario, selected: 'wall', records, pending: null, receipts: [], messages: [], notice: 'Choose a deduction. Nothing is submitted until you confirm a preview.' };
}

export function judgeSnapshot(session: JudgeSession) {
  const visible: Omit<JudgeSession, 'mcp'> & { mcp?: unknown } = { ...session };
  delete visible.mcp;
  return { ...visible, receipts: [], messages: session.messages.filter(m => m.role === session.records.role),
    pending: session.pending && session.pending.expiresAt > Date.now() ? session.pending : null,
    photos: photoIndex.filter(p => session.records.evidence.some(r => r.id === p.reportId)) };
}
export type JudgeSnapshot = ReturnType<typeof judgeSnapshot>;

function inputObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a command object.');
  return value as Record<string, unknown>;
}

// Commands cannot supply a role for confirmation, a new record snapshot, or a
// refund. The role and current state always come from the isolated server session.
export function applyJudgeCommand(before: JudgeSession, operation: string, value: unknown): JudgeSession {
  const input = inputObject(value);
  const fields: Record<string, string[]> = { role: ['role'], select: ['deductionId'], chat: ['question'],
    prepare: ['action'], confirm: ['id'], cancel: [], resume: [] };
  if (!Object.prototype.hasOwnProperty.call(fields, operation) || Object.keys(input).some(k => k !== 'revision' && !fields[operation].includes(k)))
    throw new Error('Unsupported command or field.');
  if (operation === 'confirm' && typeof input.id === 'string' && before.receipts.includes(before.records.role + ':' + input.id)) return before;
  if (!Number.isSafeInteger(input.revision) || input.revision !== before.revision) throw new Error('This demo changed in another tab. Reload and review the latest state.');
  const session = structuredClone(before);
  const records = session.records;
  if (operation === 'role') {
    if (input.role !== 'TENANT' && input.role !== 'LANDLORD') throw new Error('Invalid demo role.');
    records.role = input.role; session.pending = null; session.notice = 'Demo role switched. Unconfirmed previews were discarded.';
  } else if (operation === 'select') {
    if (typeof input.deductionId !== 'string' || !records.settlement?.deductions.some(d => d.id === input.deductionId)) throw new Error('Deduction unavailable.');
    session.selected = input.deductionId; session.pending = null; session.notice = 'Context updated. Review this deduction before deciding.';
  } else if (operation === 'cancel' || operation === 'resume') {
    session.pending = null; session.notice = 'Saved decisions are unchanged. Any unconfirmed preview was discarded.';
  } else if (operation === 'chat') {
    if (typeof input.question !== 'string' || !input.question.trim() || input.question.length > 600) throw new Error('Use a question of 1–600 characters.');
    const route = routeDialogue(records, session.selected, input.question);
    session.selected = route.deductionId; session.pending = null;
    const answer = route.question && session.selected ? answerDeductionQuestion(records, session.selected, input.question) : null;
    const text = answer?.text ?? route.notice;
    const speech = answer?.topic === 'evidence' ? spokenEvidence(records, session.selected) ?? speakable(text) : speakable(text);
    session.messages.push({ role: records.role as DemoRole, question: input.question, text, sourceIds: answer?.sourceIds ?? [], speech, provider: 'rules' });
    session.messages = session.messages.slice(-80);
    session.notice = route.notice;
    // Rule-mode chat can only select a form. AI drafts become previews through
    // recordAssistantTurn below; nothing in either path confirms a business write.
  } else if (operation === 'prepare') {
    const action = parseAction(input.action);
    if (['REPORT', 'EVIDENCE_LINK'].includes(action.kind)) throw new Error('This walkthrough uses bundled synthetic evidence only.');
    validateWorkflowAction(records, action);
    const target = action.payload.deductionId ?? eventDeduction(records, records.history.find(e => e.id === (action.payload.responseId ?? action.payload.adjustmentId ?? action.payload.disputeId)));
    if (target !== session.selected) throw new Error('Choose the matching deduction before preparing this decision.');
    const deduction = records.settlement!.deductions.find(d => d.id === target)!;
    const proposal = records.history.find(e => e.id === action.payload.adjustmentId);
    const amount = action.kind === 'ADJUSTMENT' ? action.payload.amountSen : proposal?.payload.amountSen ?? deduction.amountSen;
    session.pending = { id: randomUUID(), revision: session.revision + 1, role: records.role as DemoRole, action,
      expiresAt: Date.now() + 5 * 60000,
      description: labels[action.kind] + ' · ' + deduction.reason + ' · ' + money(amount!) + (action.kind === 'WITHDRAWAL' ? ' removed from the total' : '') };
    session.notice = 'Preview only. Check the exact item, amount and message, then confirm or cancel.';
  } else if (operation === 'confirm') {
    const pending = session.pending;
    if (!pending || pending.id !== input.id || pending.revision !== session.revision || pending.role !== records.role || pending.expiresAt <= Date.now()) throw new Error('Preview expired or changed. Prepare it again.');
    validateWorkflowAction(records, pending.action);
    const action = pending.action;
    const settlement = records.settlement!;
    const parent = records.history.find(e => e.id === (action.payload.responseId ?? action.payload.adjustmentId ?? action.payload.disputeId));
    const target = action.payload.deductionId ?? eventDeduction(records, parent);
    const d = settlement.deductions.find(d => d.id === target)!;
    const beforeRefundSen = settlement.recordedRefundSen, beforeAmountSen = d.amountSen;
    if (action.kind === 'DISPUTE') d.status = 'DISPUTED';
    if (action.kind === 'WITHDRAWAL') { settlement.recordedRefundSen = revisedRefund(records, d.id, 0); d.status = 'WITHDRAWN'; }
    if (['ACCEPTANCE', 'DEDUCTION_ACCEPTANCE'].includes(action.kind)) d.status = 'ACCEPTED';
    if (action.kind === 'ADJUSTMENT_ACCEPTANCE') {
      const amount = parent!.payload.amountSen!;
      settlement.recordedRefundSen = revisedRefund(records, d.id, amount); d.amountSen = amount; d.status = 'ACCEPTED';
    }
    settlement.status = settlement.deductions.every(d => ['ACCEPTED', 'WITHDRAWN'].includes(d.status)) ? 'AGREED'
      : settlement.deductions.some(d => d.status === 'DISPUTED') ? 'DISPUTED' : 'PROPOSED';
    records.revision++;
    records.history.push({ id: pending.id, actorId: 'demo-' + records.role.toLowerCase(), ...action, revision: records.revision,
      createdAt: new Date().toISOString(), effects: { deductionId: d.id, beforeAmountSen, afterAmountSen: d.amountSen, beforeRefundSen, afterRefundSen: settlement.recordedRefundSen } });
    session.receipts.push(records.role + ':' + pending.id); session.pending = null;
    session.notice = 'Confirmed and saved locally. No payment was made.';
  }
  session.revision++;
  return session;
}

// Records an AI assistant answer. A draft becomes the ordinary "Check before saving"
// preview through the same prepare command a person uses; nothing is confirmed here.
export function recordAssistantTurn(before: JudgeSession, revision: number, turn: AssistantTurn): JudgeSession {
  if (revision !== before.revision) throw new Error('This demo changed in another tab. Reload and review the latest state.');
  const session = structuredClone(before);
  const role = session.records.role as DemoRole;
  const deductions = session.records.settlement?.deductions ?? [];
  const message: JudgeMessage = { role, question: turn.question, text: turn.text, speech: turn.speech, sourceIds: turn.sourceIds,
    provider: 'bedrock', model: turn.model, tools: turn.tools, drafted: false };
  session.messages.push(message); session.messages = session.messages.slice(-80);
  session.pending = null;
  if (turn.draft) {
    const draft = turn.draft;
    const target = draft.payload.deductionId ?? eventDeduction(session.records, session.records.history.find(e => e.id === (draft.payload.responseId ?? draft.payload.adjustmentId ?? draft.payload.disputeId)));
    try {
      let next = session;
      if (target && target !== next.selected) next = applyJudgeCommand(next, 'select', { revision: next.revision, deductionId: target });
      next = applyJudgeCommand(next, 'prepare', { revision: next.revision, action: draft });
      next.pending!.origin = 'assistant';
      next.messages[next.messages.length - 1].drafted = true;
      next.notice = 'AI drafted this decision. Check it below, then confirm or cancel. Nothing has been saved.';
      return next;
    } catch {
      message.text += '\n\nI could not turn that draft into a valid decision for this item. Use the action menu instead.';
      message.speech += ' I could not prepare that draft. Please use the action menu.';
    }
  }
  if (turn.focus && deductions.some(d => d.id === turn.focus)) session.selected = turn.focus;
  session.notice = 'Answered by Amazon Bedrock using the RentalEase MCP tools. Nothing has been saved.';
  session.revision++;
  return session;
}

export function judgeOptions(records: Records, selected: string) {
  return optionsFor(records, selected).filter(o => !['REPORT', 'EVIDENCE_LINK'].includes(o.kind));
}
