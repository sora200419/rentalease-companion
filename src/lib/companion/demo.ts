// Synthetic, browser-local demonstration domain. Never use demo actors as authentication.
export type Role = 'TENANT' | 'LANDLORD';
export type ActionKind = 'DISPUTE' | 'WITHDRAW';
export type Source = {
  id: string; tenancyId: string; title: string; kind: 'MOVE_IN' | 'MOVE_OUT' | 'AGREEMENT';
  date: string; status: 'ACCEPTED' | 'SUBMITTED' | 'DISPUTED'; text: string;
};
export const tenancyId = 'demo-tenancy-01';
export const actors = {
  TENANT: { id: 'demo-tenant', role: 'TENANT' as Role, name: 'Aina Rahman' },
  LANDLORD: { id: 'demo-landlord', role: 'LANDLORD' as Role, name: 'Daniel Lim' },
};
export type Actor = { id: string; role: Role };
export const sources: Source[] = [
  { id: 'IN-001', tenancyId, title: 'Move-in condition report', kind: 'MOVE_IN', date: '2025-10-01', status: 'ACCEPTED', text: 'Bedroom, window wall: a short scuff below the window was recorded at move-in. Both demo parties accepted this report.' },
  { id: 'OUT-001', tenancyId, title: 'Move-out condition report', kind: 'MOVE_OUT', date: '2026-09-20', status: 'SUBMITTED', text: 'Bedroom, window wall: the landlord recorded a scuff and proposed RM300 for repainting. This report has not been accepted by the tenant.' },
  { id: 'AGR-7', tenancyId, title: 'Agreement · clause 7', kind: 'AGREEMENT', date: '2025-10-01', status: 'ACCEPTED', text: 'Synthetic demonstration clause: any proposed damage deduction should identify the damage and supporting evidence. Pre-existing marks and fair wear should be considered during the parties’ review.' },
];
export type PendingAction = { id: string; kind: ActionKind; actorId: string; version: number; draft: string };
export type Entry = { id: string; role: Role; speaker: 'USER' | 'ASSISTANT'; text: string; sourceIds: string[] };
export type DemoState = {
  schema: 1; version: number; status: 'PROPOSED' | 'DISPUTED' | 'WITHDRAWN';
  baseline: 'ACCEPTED' | 'DISPUTED' | 'MISSING'; pending: PendingAction | null;
  receipts: string[]; entries: Entry[]; activity: string[];
};
export function initialState(baseline: DemoState['baseline'] = 'ACCEPTED'): DemoState {
  return { schema: 1, version: 0, status: 'PROPOSED', baseline, pending: null, receipts: [], entries: [], activity: ['Landlord proposed RM300 for bedroom wall repainting.'] };
}
function authorize(actor: Actor, requestedTenancy: string) {
  const expected = actors[actor.role];
  if (!expected || actor.id !== expected.id || requestedTenancy !== tenancyId) throw new Error('This actor cannot access this demo tenancy.');
}
export function getEvidence(actor: Actor, requestedTenancy: string, state: DemoState): Source[] {
  authorize(actor, requestedTenancy);
  return sources.filter(s => state.baseline !== 'MISSING' || s.kind !== 'MOVE_IN')
    .map(s => s.kind === 'MOVE_IN' && state.baseline === 'DISPUTED'
      ? { ...s, status: 'DISPUTED', text: 'Bedroom, window wall: the move-in report describes a scuff below the window. The tenant disputes this baseline; the parties have not agreed on its accuracy.' }
      : { ...s });
}
export function getSettlementContext(actor: Actor, requestedTenancy: string, state: DemoState) {
  authorize(actor, requestedTenancy);
  return { depositSen: 240000, proposedDeductionSen: state.status === 'WITHDRAWN' ? 0 : 30000,
    proposedRefundSen: state.status === 'WITHDRAWN' ? 240000 : 210000, status: state.status };
}
export function prepareAction(state: DemoState, actor: Actor, kind: ActionKind, id: string): DemoState {
  authorize(actor, tenancyId);
  if (!id || state.receipts.includes(`${actor.id}:${id}`)) throw new Error('Use a new confirmation reference.');
  if (kind !== 'DISPUTE' && kind !== 'WITHDRAW') throw new Error('Unsupported action.');
  if (kind === 'DISPUTE' && (actor.role !== 'TENANT' || state.status !== 'PROPOSED')) throw new Error('Only the tenant can dispute a proposed deduction.');
  if (kind === 'WITHDRAW' && (actor.role !== 'LANDLORD' || state.status === 'WITHDRAWN')) throw new Error('Only the landlord can withdraw an active deduction.');
  const draft = kind === 'WITHDRAW'
    ? 'I withdraw the RM300 bedroom-wall deduction. The proposed refund becomes RM2,400. This does not mark any money as paid.'
    : state.baseline === 'ACCEPTED'
      ? 'I dispute the RM300 bedroom-wall deduction. The accepted move-in report IN-001 recorded a scuff in the same area. Please compare it with OUT-001 and review the proposal under clause AGR-7.'
      : state.baseline === 'DISPUTED'
        ? 'I dispute the RM300 bedroom-wall deduction. The move-in report IN-001 is itself disputed. Please review both parties’ evidence alongside OUT-001 and clause AGR-7 before resolving the deduction.'
        : 'I dispute the RM300 bedroom-wall deduction and request supporting evidence. No move-in report is available in this demo, so I cannot establish whether the mark was pre-existing.';
  return { ...state, pending: { id, kind, actorId: actor.id, version: state.version, draft } };
}
export function confirmAction(state: DemoState, actor: Actor, id: string): DemoState {
  authorize(actor, tenancyId);
  // Receipts include the actor so a retry cannot authorize a different role.
  if (state.receipts.includes(`${actor.id}:${id}`)) return state;
  const action = state.pending;
  if (!action || action.id !== id || action.actorId !== actor.id || action.version !== state.version) throw new Error('This confirmation is no longer valid. Prepare the action again.');
  // Re-check authority and state at confirmation, not just when drafting.
  prepareAction(state, actor, action.kind, id);
  return { ...state, version: state.version + 1,
    status: action.kind === 'DISPUTE' ? 'DISPUTED' : 'WITHDRAWN', pending: null,
    receipts: [...state.receipts, `${actor.id}:${id}`],
    activity: [...state.activity, `${actors[actor.role].name}: ${action.draft}`] };
}
export type AssistantReply = { text: string; sourceIds: string[]; suggestedAction?: ActionKind };
// Deliberately deterministic: a replaceable, no-network provider for the first demo.
export function replyTo(actor: Actor, state: DemoState, question: string): AssistantReply {
  const evidence = getEvidence(actor, tenancyId, state);
  const text = question.toLowerCase();
  if (/withdraw|撤回/.test(text)) return { text: actor.role === 'LANDLORD' ? 'Review the withdrawal below. It takes effect only when you press Confirm withdrawal.' : 'Only the landlord can withdraw this deduction. You can prepare a dispute instead.', sourceIds: [], suggestedAction: actor.role === 'LANDLORD' && state.status !== 'WITHDRAWN' ? 'WITHDRAW' : undefined };
  if (/dispute|respond|draft|争议|反对/.test(text)) return { text: actor.role === 'TENANT' && state.status === 'PROPOSED' ? 'I can prepare an evidence-based response. Review the draft, then explicitly confirm to record the dispute in this demo.' : 'A new tenant dispute is not available for your current role or the current settlement state.', sourceIds: evidence.map(s => s.id), suggestedAction: actor.role === 'TENANT' && state.status === 'PROPOSED' ? 'DISPUTE' : undefined };
  if (/refund|deposit|status|balance|押金|进度/.test(text)) {
    const context = getSettlementContext(actor, tenancyId, state);
    return { text: `The recorded deposit is RM2,400. The deduction is ${state.status.toLowerCase()}; the proposed refund is ${money(context.proposedRefundSen)}. ${state.status === 'DISPUTED' ? 'The amount is still under review.' : ''} No payment has been made by this demo.`, sourceIds: [] };
  }
  if (/evidence|wall|mark|report|clause|compare|scuff|证据|墙|合同/.test(text)) return {
    text: state.baseline === 'MISSING'
      ? 'The move-in report is missing. OUT-001 records a proposed RM300 deduction, but this alone cannot establish when the mark appeared. AGR-7 asks the parties to consider supporting evidence. Request the missing baseline before drawing a conclusion.'
      : state.baseline === 'DISPUTED'
        ? 'IN-001 describes a mark in the same area, but that baseline is disputed. OUT-001 is also awaiting tenant review. Compare both parties’ evidence under AGR-7; these records do not establish who is responsible.'
        : 'IN-001 records a scuff below the bedroom window at move-in. OUT-001 proposes RM300 for a scuff in that area. AGR-7 calls for considering pre-existing marks. This supports asking for a review, but does not prove the marks are identical or determine liability.',
    sourceIds: evidence.map(s => s.id),
  };
  return { text: 'This offline demo supports evidence review, deposit status, preparing a tenant dispute, and withdrawing a landlord deduction. Try “Compare the wall evidence” or choose one of the suggested questions. Free-form AI and image analysis are not connected yet.', sourceIds: [] };
}
export function money(sen: number) { return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(sen / 100); }

// Restore only known, internally consistent demo state. Confirmations never survive reload.
export function restoreState(raw: string | null): DemoState {
  if (!raw) return initialState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return initialState();
    const s = value as DemoState;
    if (s.schema !== 1 || !Number.isInteger(s.version) || s.version < 0 ||
      !['PROPOSED', 'DISPUTED', 'WITHDRAWN'].includes(s.status) ||
      !['ACCEPTED', 'DISPUTED', 'MISSING'].includes(s.baseline) ||
      !Array.isArray(s.entries) || s.entries.length > 100 ||
      !s.entries.every(e => e && typeof e.id === 'string' && ['TENANT', 'LANDLORD'].includes(e.role) && ['USER', 'ASSISTANT'].includes(e.speaker) && typeof e.text === 'string' && e.text.length <= 4000 && Array.isArray(e.sourceIds) && e.sourceIds.every(id => sources.some(source => source.id === id))) ||
      !Array.isArray(s.activity) || !s.activity.every(a => typeof a === 'string') ||
      !Array.isArray(s.receipts) || !s.receipts.every(r => typeof r === 'string')) return initialState();
    return { schema: 1, version: s.version, status: s.status, baseline: s.baseline,
      entries: s.entries, activity: s.activity, receipts: s.receipts, pending: null };
  } catch { return initialState(); }
}
