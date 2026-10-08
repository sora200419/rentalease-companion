import type { Records } from './records-workflow';

// Shared by the server (rule-mode speech) and the browser (voice input/output).

// "Alexa, ask RentalEase whether the scuff was there" -> "whether the scuff was there".
// The simulation accepts an optional invocation phrase; it is never required.
export function normalizeSpokenQuestion(value: string) {
  return value.trim()
    .replace(/^(?:(?:hey|ok|okay)[ ,]+)?(?:alexa|rental ?ease)[ ,.!:]*/i, '')
    .replace(/^(?:ask|tell|open)[ ,]+rental ?ease[ ,.!:]*(?:to |about )?/i, '')
    .replace(/^\w/, c => c.toUpperCase());
}

// Remove citation markers and layout so a speech synthesizer reads natural sentences.
export function speakable(text: string, limit = 520) {
  const plain = text.replace(/\s*\[[a-zA-Z0-9:_-]{1,80}\]/g, '').replace(/[*_#`>]+/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= limit) return plain;
  const cut = plain.slice(0, limit), end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…') + ' The details are on screen.';
}

export function spokenMoney(sen: number) {
  const ringgit = Math.floor(sen / 100), rest = sen % 100;
  return ringgit + ' ringgit' + (rest ? ' ' + rest + ' sen' : '');
}

// Report notes carry a visible "SYNTHETIC MOVE-IN:" style label for the screen; drop it when speaking.
const quote = (text: string | null) => (text ?? '').replace(/^[A-Z][A-Z -]{3,40}:\s*/, '').trim();

// Rule-mode starting text for a tenant dispute, quoting the recorded baseline. It only
// fills the editable form; the person still reviews, previews and confirms it.
export function disputeTemplate(records: Records) {
  const moveIn = records.evidence.find(e => e.kind === 'MOVE_IN');
  if (!moveIn?.text?.trim()) return 'I dispute this deduction. No move-in report is available to compare with, so please share the evidence that supports this charge.';
  return `I dispute this deduction. The move-in report (${moveIn.status.toLowerCase()}) recorded: “${quote(moveIn.text)}” Please review this record before applying the charge.`.slice(0, 2000);
}

// A short spoken version of a rule-mode evidence answer. The screen keeps the full quotation.
export function spokenEvidence(records: Records, deductionId: string) {
  const d = records.settlement?.deductions.find(item => item.id === deductionId);
  if (!d) return null;
  const moveIn = records.evidence.find(e => e.kind === 'MOVE_IN');
  const moveOut = records.evidence.find(e => e.kind === 'MOVE_OUT');
  const contested = records.evidence.filter(e => e.kind === 'INSPECTION' && e.status === 'DISPUTED');
  const parts = [`For the ${d.reason.toLowerCase()} deduction of ${spokenMoney(d.amountSen)}:`];
  parts.push(moveIn
    ? `the move-in report${['ACCEPTED', 'LOCKED'].includes(moveIn.status) ? '' : ', which is still ' + moveIn.status.toLowerCase() + ','} says: ${quote(moveIn.text) || 'no written notes'}`
    : 'there is no move-in report, so I cannot say what the condition was at the start.');
  if (moveOut) parts.push(`The move-out report says: ${quote(moveOut.text) || 'no written notes'}`);
  for (const account of contested) parts.push(`There is also a disputed account: ${quote(account.text)}`);
  parts.push('The records alone do not decide who pays. The photos and sources are on screen.');
  return speakable(parts.join(' ').replace(/([^.?!])\s+(The|There)/g, '$1. $2'), 700);
}
