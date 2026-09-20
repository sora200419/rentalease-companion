import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import RenewForm from './RenewForm';

export default async function RenewPage({
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
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
      depositAmount: true,
      tenant: { select: { name: true } },
      room: { select: { label: true, property: { select: { address: true } } } },
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));
  if (!['ACTIVE', 'EXPIRED'].includes(tenancy.status)) redirect(`/dashboard/landlord/tenancies/${id}`);

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link href="/dashboard/landlord/tenancies" className="hover:text-[#C49A3C] transition-colors">
          Tenancies
        </Link>
        <span>/</span>
        <Link href={`/dashboard/landlord/tenancies/${id}`} className="hover:text-[#C49A3C] transition-colors">
          {tenancy.room.property.address} — {tenancy.room.label}
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Renew</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Renew Tenancy</h1>
        <p className="text-white/50 text-sm mt-1">
          Create a new tenancy for {tenancy.tenant.name} in the same room. The tenant will receive an invitation to accept the renewed terms.
        </p>
      </div>

      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
        <RenewForm
          tenancyId={id}
          currentEndDate={tenancy.endDate.toISOString()}
          currentMonthlyRent={Number(tenancy.monthlyRent)}
          currentDepositAmount={Number(tenancy.depositAmount)}
        />
      </div>
    </div>
  );
}
