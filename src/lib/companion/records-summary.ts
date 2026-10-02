import { availableAdjustments, availableResponses, eventDeduction, money, type Records } from './records-workflow';

// A view of an already-authorized snapshot, never a settlement mutation.
export function settlementSummary(records: Records) {
  const settlement = records.settlement;
  const proposals = availableAdjustments(records);
  const replies = availableResponses(records);
  const items = (settlement?.deductions ?? []).map((deduction, index) => {
    const resolved = ['ACCEPTED', 'WITHDRAWN'].includes(deduction.status);
    const proposal = proposals.find(e => e.payload.deductionId === deduction.id);
    const reply = replies.find(e => eventDeduction(records, e) === deduction.id);
    let next = 'Review this deduction and its sources.';
    if (deduction.status === 'WITHDRAWN') next = 'Withdrawn by the landlord; excluded from the total.';
    else if (deduction.status === 'ACCEPTED') next = 'Accepted; no further deduction decision is available.';
    else if (proposal) next = records.role === 'TENANT'
      ? 'Review the revised proposal, then accept or reject it.'
      : 'Await the tenant’s decision on the revised proposal.';
    else if (reply) next = records.role === 'TENANT'
      ? 'Review the landlord’s reply, then accept or reject it.'
      : 'Await the tenant’s decision on your reply.';
    else if (deduction.status === 'DISPUTED') next = records.role === 'LANDLORD'
      ? 'Review the dispute: reply, propose a revised amount, or withdraw.'
      : 'Await a landlord reply, revised proposal, or withdrawal.';
    else if (deduction.status === 'PROPOSED') next = records.role === 'TENANT'
      ? 'Review the evidence, then accept or dispute this deduction.'
      : 'Await tenant review, or withdraw this deduction.';
    return { ...deduction, number: index + 1, resolved, next,
      contributionSen: deduction.status === 'WITHDRAWN' ? 0 : deduction.amountSen,
      pendingAmountSen: proposal?.payload.amountSen ?? null,
      sources: records.history.filter(e => e.kind === 'EVIDENCE_LINK' && e.payload.deductionId === deduction.id)
        .map(e => ({ id: e.id, reportId: e.payload.reportId ?? '', filename: (e.payload.fileKey ?? '').split('--').slice(2).join('--') || 'Unnamed file' })),
    };
  });
  const totalSen = items.reduce((sum, d) => sum + d.contributionSen, 0);
  const resolvedCount = items.filter(d => d.resolved).length;
  const warnings: string[] = [];
  const validAmount = (value: number) => Number.isSafeInteger(value) && value >= 0;
  if (settlement) {
    if (![records.depositSen, settlement.recordedOriginalSen, settlement.recordedRefundSen, totalSen, ...items.map(d => d.amountSen)].every(validAmount)
      || settlement.recordedOriginalSen !== records.depositSen
      || totalSen > settlement.recordedOriginalSen
      || settlement.recordedOriginalSen - totalSen !== settlement.recordedRefundSen)
      warnings.push('Recorded amounts do not reconcile. Review the source records before relying on this summary.');
    if (items.some(d => !['PROPOSED', 'DISPUTED', 'ACCEPTED', 'WITHDRAWN'].includes(d.status)))
      warnings.push('An unrecognized deduction status needs review.');
    if (['AGREED', 'PAID'].includes(settlement.status) && resolvedCount !== items.length)
      warnings.push('The settlement is marked closed but contains unresolved deductions.');
  }
  const complete = !!settlement && ['AGREED', 'PAID'].includes(settlement.status)
    && resolvedCount === items.length && warnings.length === 0;
  return { items, totalSen, resolvedCount, warnings, complete,
    title: !settlement ? 'No settlement recorded' : warnings.length ? 'Records need review' : complete ? 'Every deduction is resolved' : 'Review in progress',
    paymentNotice: settlement?.paymentRecorded
      ? 'A payment is recorded in the database. This summary does not independently verify a bank transfer.'
      : 'No completed payment is established by these records. An agreement is not a refund transfer.',
  };
}

// Quote user-authored text so multiline notes cannot masquerade as headings.
const quote = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').split(/\r?\n/).map(line => '  | ' + line).join('\n');

export function settlementSummaryText(records: Records, generatedAt: string) {
  const summary = settlementSummary(records);
  const settlement = records.settlement;
  const lines = [
    'RENTALEASE — DEVELOPMENT SETTLEMENT SUMMARY',
    'SYNTHETIC TEST RECORDS · NOT A PAYMENT RECEIPT OR LEGAL FINDING',
    'Generated (UTC): ' + generatedAt, 'Tenancy: ' + records.tenancyId,
    'Record revision: ' + records.revision, 'Status: ' + (settlement?.status ?? 'Not recorded'),
    'Review: ' + summary.title, 'Deposit: ' + money(records.depositSen),
    'Active deductions: ' + (settlement ? money(summary.totalSen) : 'Not recorded'),
    'Recorded refund: ' + (settlement ? money(settlement.recordedRefundSen) : 'Not recorded'),
    'Resolved items: ' + summary.resolvedCount + '/' + summary.items.length,
    summary.paymentNotice, ...summary.warnings.map(warning => 'WARNING: ' + warning),
    '', 'DEDUCTIONS',
  ];
  for (const item of summary.items) {
    lines.push('', item.number + '. ' + item.id + ' [' + item.status + ']', quote(item.reason),
      'Recorded amount: ' + money(item.amountSen), 'Contribution to current total: ' + money(item.contributionSen), item.next);
    if (item.pendingAmountSen !== null) lines.push('Pending proposal: ' + money(item.pendingAmountSen) + ' — NOT applied to the current total.');
    lines.push('Linked files:');
    if (!item.sources.length) lines.push('None recorded for this deduction.');
    for (const source of item.sources) lines.push(quote(source.filename), 'Report: ' + source.reportId + ' · Link event: ' + source.id);
  }
  lines.push('', 'SOURCE INDEX — REPORTED TEXT, NOT INDEPENDENT FINDINGS');
  for (const source of records.evidence) lines.push('', source.id + ' [' + source.kind + '; ' + source.status + ']', quote(source.text ?? 'No written notes recorded.'));
  if (records.agreement) lines.push('', records.agreement.id + ' [AGREEMENT; ' + records.agreement.status + ']', quote(records.agreement.text));
  lines.push('', 'SAVED DECISIONS — OLDEST FIRST');
  const decisions = records.history.filter(e => !['REPORT', 'EVIDENCE_LINK'].includes(e.kind)).slice().sort((a, b) => a.revision - b.revision);
  if (!decisions.length) lines.push('No saved decisions in this snapshot.');
  for (const event of decisions) {
    lines.push('', 'Revision ' + event.revision + ' · ' + event.kind + ' · ' + event.createdAt,
      'Event: ' + event.id + ' · Deduction: ' + (eventDeduction(records, event) ?? 'Unresolved reference'), quote(event.payload.text));
    if (event.kind === 'ADJUSTMENT' && event.payload.amountSen !== undefined) lines.push('Proposed at this event: ' + money(event.payload.amountSen) + ' (not proof of acceptance).');
    if (event.effects?.beforeRefundSen !== undefined && event.effects.afterRefundSen !== undefined)
      lines.push('Recorded refund changed: ' + money(event.effects.beforeRefundSen) + ' → ' + money(event.effects.afterRefundSen));
  }
  lines.push('', 'ABOUT THIS EXPORT',
    'This read-only snapshot was retrieved after an account and tenancy access check. Later changes are not included.',
    'Files remain private and are not embedded. Sign in to the records workspace to inspect the referenced originals.',
    'File contents have not been analysed. Upload times do not prove capture times; source statements do not establish liability.',
    'No records were changed, no agreement was signed, and no payment was made by this export.');
  return lines.join('\n') + '\n';
}
