import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DepositSettlementClient from './DepositSettlementClient';
import { attachEvidencePhotosToDeductions } from '@/lib/depositSettlementWorkflow';

export default async function DepositSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      room: { property: { landlordId: session.user.id } },
    },
    include: {
      tenant: { select: { name: true, email: true } },
      room: { include: { property: { select: { address: true } } } },
      depositRefund: {
        include: {
          deductions: { orderBy: { createdAt: 'asc' } },
        },
      },
      conditionReports: {
        where: { type: { in: ['MOVE_IN', 'MOVE_OUT'] } },
        include: {
          photos: { select: { id: true, room: true, imageUrl: true } },
          checklistItems: { select: { area: true } },
        },
      },
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));
  if (!['EXPIRED', 'TERMINATED', 'ACTIVE'].includes(tenancy.status)) redirect(`/dashboard/landlord/tenancies/${id}`);

  const moveInReport = tenancy.conditionReports.find((r) => r.type === 'MOVE_IN') ?? null;
  const moveOutReport = tenancy.conditionReports.find((r) => r.type === 'MOVE_OUT') ?? null;

  const moveInStatus = moveInReport?.status ?? null;
  const moveOutStatus = moveOutReport?.status ?? null;
  const moveOutPhotos =
    moveOutReport?.photos.map((p) => ({
      id: p.id,
      area: p.room,
      imageUrl: p.imageUrl,
    })) ?? [];

  const warnings: string[] = [];
  if (!moveInReport) warnings.push('No move-in report exists. Baseline evidence is missing.');
  else if (moveInStatus !== 'ACCEPTED') warnings.push(`Move-in report is not accepted (status: ${moveInStatus}). Baseline evidence may be disputed.`);
  if (!moveOutReport) warnings.push('No move-out report exists. Deduction evidence is missing.');
  else if (moveOutStatus === 'DISPUTED') warnings.push('Move-out report is disputed. Review counter evidence before confirming deductions.');

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link href="/dashboard/landlord/tenancies" className="hover:text-[#C49A3C] transition-colors">
          Tenancies
        </Link>
        <span>/</span>
        <Link href={`/dashboard/landlord/tenancies/${id}`} className="hover:text-[#C49A3C] transition-colors">
          {tenancy.room.property.address} — {tenancy.room.label}
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Deposit Settlement</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Deposit Settlement</h1>
        <p className="text-white/50 text-sm mt-1">
          Security deposit: RM {Number(tenancy.depositAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} · Tenant: {tenancy.tenant.name}
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-[#E8B84B] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm text-[#E8B84B]">{w}</p>
            </div>
          ))}
        </div>
      )}

      <DepositSettlementClient
        tenancyId={id}
        tenantName={tenancy.tenant.name}
        existingRefund={tenancy.depositRefund ? {
          id: tenancy.depositRefund.id,
          status: tenancy.depositRefund.status,
          originalAmount: Number(tenancy.depositRefund.originalAmount),
          refundAmount: Number(tenancy.depositRefund.refundAmount),
          paidAt: tenancy.depositRefund.paidAt?.toISOString() ?? null,
          paidProofUrl: tenancy.depositRefund.paidProofUrl,
          deductions: attachEvidencePhotosToDeductions(
            tenancy.depositRefund.deductions.map((d) => ({
              id: d.id,
              reason: d.reason,
              amount: Number(d.amount),
              status: d.status,
              tenantDisputeNote: d.tenantDisputeNote,
              photoIds: d.photoIds,
            })),
            moveOutPhotos,
          ),
        } : null}
        moveOutPhotos={moveOutPhotos}
      />
    </div>
  );
}
