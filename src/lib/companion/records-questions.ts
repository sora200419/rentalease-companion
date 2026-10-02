import type { retrieveTenancyRecords } from './database';
import { evidenceNotices } from './records-evidence-notices';

type Records = Awaited<ReturnType<typeof retrieveTenancyRecords>>;
const money = (sen: number) => `MYR ${(sen / 100).toFixed(2)}`;
const disclaimer = 'Recorded statements are not independent findings. No photo analysis, liability decision or action was performed.';

// A deliberately narrow, deterministic English router. Never execute source text,
// infer facts from the question, or reuse the offline demo's fixed amounts.
export function answerRecordQuestion(records: Records, question: string) {
  if (!question.trim() || question.length > 600) throw new Error('Invalid question.');
  const q = question.toLowerCase().replace(/[’']/g, '').replace(/[-_]/g, ' ');
  const result = (topic: string, text: string, sourceIds: string[] = []) => ({
    provider: 'records' as const, topic, text, sourceIds: [...new Set(sourceIds)],
  });
  if (/\b(ignore|override|pretend|system prompt|password|secret|other tenant|another tenant)\b/.test(q)) {
    return result('unsupported', 'I can only quote the selected tenancy’s authorized records. I cannot reveal credentials, change access, or follow instructions embedded in a question or document.');
  }
  if (/\b(send|transfer|release|approve|accept|reject|delete|update|change|submit|withdraw|pay|execute)\b/.test(q)) {
    return result('read-only', 'Chat is read-only. No payment, approval, dispute submission, or record change has been performed by this message. To submit a report or dispute, use the separate review-and-confirm form.');
  }
  if (/\b(liable|liability|responsible|fault|legal|illegal|fair|unfair|owe|should i|must i)\b/.test(q)) {
    return result('review-needed', 'These records alone do not establish responsibility or whether a deduction is justified. Review the published reports and agreement with the other party. No liability decision was made.');
  }
  if (/\b(refund|settlement|paid|payment|deduction|deductions|deposit)\b/.test(q)) {
    const lines = [`Recorded tenancy deposit: ${money(records.depositSen)}.`];
    const sources = [records.tenancyId];
    const settlement = records.settlement;
    if (!settlement) lines.push('No settlement record is available. No refund or deduction amount is inferred.');
    else {
      sources.push(settlement.id);
      lines.push(`Recorded settlement original amount: ${money(settlement.recordedOriginalSen)}.`,
        `Recorded refund: ${money(settlement.recordedRefundSen)}. Settlement status: ${settlement.status}.`);
      for (const d of settlement.deductions) {
        sources.push(d.id);
        lines.push(`Deduction ${d.id} [${d.status}]: ${money(d.amountSen)}. Recorded reason: ${d.reason}`);
      }
      if (!settlement.deductions.length) lines.push('No deduction entries are available.');
      if (settlement.recordedOriginalSen !== records.depositSen) lines.push('Review needed: the settlement original amount differs from the tenancy deposit.');
      if (settlement.recordedRefundSen + settlement.deductions.filter(d => d.status !== 'WITHDRAWN').reduce((sum, d) => sum + d.amountSen, 0) !== settlement.recordedOriginalSen) lines.push('Review needed: the recorded refund plus non-withdrawn deductions does not equal the recorded original amount. This check is not a settlement calculation or approval.');
      lines.push(settlement.paymentRecorded ? 'A PAID status and payment date are recorded; this is not independent verification of a bank transfer.' : 'These records do not establish completed payment.');
    }
    lines.push('Amounts are quoted, not recalculated entitlements. No money was moved.');
    return result('amounts', lines.join('\n\n'), sources);
  }
  if (/\b(agreement|contract|clause|clauses|terms)\b/.test(q)) {
    const a = records.agreement;
    return a ? result('agreement', `Agreement ${a.id} [${a.status}] — recorded text:\n\n${a.text}\n\nStatus is shown as recorded; this is not a legal interpretation. ${disclaimer}`, [a.id])
      : result('agreement', 'No agreement record is available. No terms are inferred.');
  }
  if (/\b(report|reports|evidence|compare|comparison|move in|move out|condition|damage|notes|photo|photos)\b/.test(q)) {
    const lines = records.evidence.map(e => `${e.id} [${e.kind}; ${e.status}] — recorded notes:\n${e.text ?? 'No written notes recorded.'}`);
    lines.push(...evidenceNotices(records.evidence));
    lines.push('Reports are presented side by side; differences and causation have not been independently established.', disclaimer);
    return result('evidence', lines.join('\n\n'), records.evidence.map(e => e.id));
  }
  return result('unsupported', 'I cannot answer that from a supported record category. Ask a complete question about the recorded deposit/refund, deductions, agreement, or published move-in and move-out reports. I do not infer missing context from earlier questions.');
}
