// src/app/(dashboard)/dashboard/landlord/tenancies/[id]/agreement/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AgreementViewer from '@/components/ui/AgreementViewer';

export default async function AgreementPage({
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
      agreementPreferences: { select: { isComplete: true } },
      room: {
        include: {
          property: { select: { address: true, city: true } },
        },
      },
      tenant: { select: { name: true, icNumber: true } },
      agreement: {
        include: {
          events: { orderBy: { createdAt: 'desc' } },
          revisions: { orderBy: { versionNumber: 'desc' } },
          changeRequests: { orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));
  if (!tenancy.agreement) redirect(`/dashboard/landlord/tenancies/${id}`);

  let redFlags: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    clause: string;
    issue: string;
    recommendation: string;
  }> = [];
  if (tenancy.agreement.redFlags) {
    try {
      redFlags = JSON.parse(tenancy.agreement.redFlags);
    } catch {
      redFlags = [];
    }
  }

  const isSigned = tenancy.agreement.status === 'SIGNED';
  const finalizeChecklistBase = {
    hasRawContent: tenancy.agreement.rawContent.trim().length > 0,
    isWizardComplete: tenancy.agreementPreferences?.isComplete === true,
    unresolvedStructuredRequests: tenancy.agreement.changeRequests.filter(
      (request) => request.status === 'PENDING',
    ).length,
    hasRequiredIdentityData: Boolean(tenancy.tenant.icNumber?.trim()),
    isFinalizableStatus: ['DRAFT', 'NEGOTIATING'].includes(tenancy.agreement.status),
  };

  // Parse Malay red flags if present
  let redFlagsMs: typeof redFlags | null = null;
  if (tenancy.agreement.redFlagsMs) {
    try { redFlagsMs = JSON.parse(tenancy.agreement.redFlagsMs); } catch { redFlagsMs = null; }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link
          href="/dashboard/landlord/tenancies"
          className="hover:text-[#C49A3C] transition-colors"
        >
          Tenancies
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/landlord/tenancies/${id}`}
          className="hover:text-[#C49A3C] transition-colors"
        >
          {tenancy.room.property.address}
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Agreement</span>
      </div>

      {/* Viewer — always shown */}
      <AgreementViewer
        agreementId={tenancy.agreement.id}
        status={tenancy.agreement.status}
        rawContent={tenancy.agreement.rawContent}
        plainLanguageSummary={tenancy.agreement.plainLanguageSummary}
        plainLanguageSummaryMs={tenancy.agreement.plainLanguageSummaryMs}
        redFlags={redFlags}
        redFlagsMs={redFlagsMs}
        tenantName={tenancy.tenant.name}
        propertyAddress={`${tenancy.room.property.address}, ${tenancy.room.property.city} — ${tenancy.room.label}`}
        contentHash={tenancy.agreement.contentHash}
        signedAt={tenancy.agreement.signedAt}
        signedByIp={tenancy.agreement.signedByIp}
        txHash={tenancy.agreement.txHash}
        events={tenancy.agreement.events}
        revisions={tenancy.agreement.revisions}
        changeRequests={tenancy.agreement.changeRequests}
        finalizeChecklistBase={isSigned ? null : finalizeChecklistBase}
        editable={!isSigned}
        editableInitialContent={tenancy.agreement.rawContent}
        negotiationNotes={tenancy.agreement.negotiationNotes}
        tenancyStartDate={tenancy.startDate.toISOString()}
        tenancyEndDate={tenancy.endDate.toISOString()}
        tenancyMonthlyRent={Number(tenancy.monthlyRent)}
        tenancyDepositAmount={Number(tenancy.depositAmount)}
      />

      {/* Editor — only for landlord, only before signing */}
      {/* If signed, explain why editing is locked */}
      {isSigned && (
        <div className="mt-6 bg-white/[0.03] border border-[rgba(196,154,60,0.15)] rounded-xl px-5 py-4">
          <p className="text-sm text-white/50">
            This agreement has been signed by the tenant and cannot be
            edited. If both parties agree to changes, a new tenancy agreement
            would need to be created.
          </p>
        </div>
      )}
    </div>
  );
}
