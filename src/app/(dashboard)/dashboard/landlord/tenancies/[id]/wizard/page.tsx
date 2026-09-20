import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { WizardContainer } from '@/components/wizard/WizardContainer';

export default async function WizardPage({
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
      room: {
        include: { property: { select: { address: true, city: true } } },
      },
      tenant: { select: { name: true } },
      agreementPreferences: true,
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));

  // Guard: wizard only accessible for PENDING status (tenant accepted)
  if (tenancy.status === 'INVITED') {
    redirect(`/dashboard/landlord/tenancies/${id}`);
  }
  if (tenancy.status === 'EXPIRED' || tenancy.status === 'TERMINATED') {
    redirect(`/dashboard/landlord/tenancies/${id}`);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link href="/dashboard/landlord/tenancies" className="hover:text-[#C49A3C] transition-colors">
          Tenancies
        </Link>
        <span>/</span>
        <Link
          href={`/dashboard/landlord/tenancies/${id}`}
          className="hover:text-[#C49A3C] transition-colors"
        >
          {tenancy.room.property.address} — {tenancy.room.label}
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Agreement Wizard</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Agreement Wizard</h1>
        <p className="text-white/50 text-sm mt-1">
          Tenant: <span className="font-medium">{tenancy.tenant.name}</span>
          {' · '}
          {tenancy.room.property.address}, {tenancy.room.property.city}
        </p>
        {tenancy.agreementPreferences && !tenancy.agreementPreferences.isComplete && (
          <div className="mt-3 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-lg px-4 py-3 text-sm text-[#E8B84B]">
            You have a draft in progress. Continue where you left off or start over by adjusting your answers.
          </div>
        )}
      </div>

      <WizardContainer
        tenancyId={id}
        roomMeta={{
          wifiIncluded: tenancy.room.wifiIncluded,
          waterIncluded: tenancy.room.waterIncluded,
          electricIncluded: tenancy.room.electricIncluded,
        }}
        existingPreferences={
          tenancy.agreementPreferences
            ? {
                ...tenancy.agreementPreferences,
                // Prisma Decimal cannot cross the server→client boundary — convert to number
                petsDeposit: tenancy.agreementPreferences.petsDeposit !== null
                  ? Number(tenancy.agreementPreferences.petsDeposit)
                  : null,
                latePenaltyAmount: tenancy.agreementPreferences.latePenaltyAmount !== null
                  ? Number(tenancy.agreementPreferences.latePenaltyAmount)
                  : null,
                rentIncreasePercent: tenancy.agreementPreferences.rentIncreasePercent !== null
                  ? Number(tenancy.agreementPreferences.rentIncreasePercent)
                  : null,
                minorRepairThreshold: Number(tenancy.agreementPreferences.minorRepairThreshold),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any
            : null
        }
      />
    </div>
  );
}
