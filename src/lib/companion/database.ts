import type { PrismaClient } from '@prisma/client';

export function decimalToSen(value: { toString(): string }): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.toString());
  if (!match) throw new Error('Invalid recorded amount.');
  const sen = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(sen)) throw new Error('Amount out of range.');
  return sen;
}

// The caller must derive authenticatedUserId from a verified server session,
// never from a request body or the offline demo role selector.
export async function retrieveTenancyRecords(db: PrismaClient, authenticatedUserId: string, tenancyId: string) {
  if (!authenticatedUserId || !tenancyId) throw new Error('Tenancy unavailable.');
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: authenticatedUserId }, select: { id: true, role: true, isSuspended: true, deletedAt: true } });
    if (!user || user.isSuspended || user.deletedAt || !['TENANT', 'LANDLORD'].includes(user.role)) throw new Error('Tenancy unavailable.');
    const tenancy = await tx.tenancy.findFirst({
      where: { id: tenancyId, ...(user.role === 'TENANT' ? { tenantId: user.id } : { room: { property: { landlordId: user.id } } }) },
      select: { id: true, depositAmount: true,
        conditionReports: { where: { status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'CORRECTION_REQUESTED', 'COUNTER_EVIDENCE_ADDED', 'ACCEPTED', 'DISPUTED', 'LOCKED'] } },
          select: { id: true, type: true, status: true, notes: true, submittedAt: true }, orderBy: { createdAt: 'asc' } },
        agreement: { select: { id: true, rawContent: true, status: true } },
        depositRefund: { select: { id: true, status: true, originalAmount: true, refundAmount: true, paidAt: true,
          deductions: { select: { id: true, reason: true, amount: true, status: true }, orderBy: { createdAt: 'asc' } } } },
      },
    });
    if (!tenancy) throw new Error('Tenancy unavailable.');
    const refund = tenancy.depositRefund;
    return { tenancyId: tenancy.id, role: user.role,
      depositSen: decimalToSen(tenancy.depositAmount),
      settlement: refund ? { id: refund.id, status: refund.status, recordedOriginalSen: decimalToSen(refund.originalAmount),
        recordedRefundSen: decimalToSen(refund.refundAmount), paymentRecorded: refund.status === 'PAID' && refund.paidAt !== null,
        deductions: refund.deductions.map(d => ({ id: d.id, reason: d.reason, amountSen: decimalToSen(d.amount), status: d.status })) } : null,
      evidence: tenancy.conditionReports.map(r => ({ id: r.id, kind: r.type, status: r.status, text: r.notes, submittedAt: r.submittedAt?.toISOString() ?? null })),
      agreement: tenancy.agreement ? { id: tenancy.agreement.id, status: tenancy.agreement.status, text: tenancy.agreement.rawContent } : null,
    };
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}

export async function listAuthorizedTenancies(db: PrismaClient, authenticatedUserId: string) {
  if (!authenticatedUserId) throw new Error('Tenancy unavailable.');
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: authenticatedUserId }, select: { id: true, role: true, isSuspended: true, deletedAt: true } });
    if (!user || user.deletedAt || user.isSuspended || !['TENANT', 'LANDLORD'].includes(user.role)) throw new Error('Tenancy unavailable.');
    const tenancies = await tx.tenancy.findMany({
      where: user.role === 'TENANT' ? { tenantId: user.id } : { room: { property: { landlordId: user.id } } },
      select: { id: true, status: true, room: { select: { label: true } } }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    return { role: user.role, tenancies };
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}

// Exact records instead of free-form paraphrase: an accuracy baseline for later AI.
export function recordEvidenceAnswer(records: Awaited<ReturnType<typeof retrieveTenancyRecords>>) {
  const sourceIds = records.evidence.map(e => e.id);
  const lines = records.evidence.map(e => `${e.id} [${e.kind}; ${e.status}]: ${e.text ?? 'No written notes recorded.'}`);
  if (!records.evidence.some(e => e.kind === 'MOVE_IN')) lines.unshift('No published move-in report is available.');
  if (records.agreement) {
    sourceIds.push(records.agreement.id);
    lines.push(`${records.agreement.id} [agreement; ${records.agreement.status}]: ${records.agreement.text}`);
  }
  lines.push('These are recorded statements, not independent findings. No photo analysis, liability decision or action was performed.');
  return { provider: 'records' as const, text: lines.join('\n\n'), sourceIds };
}
