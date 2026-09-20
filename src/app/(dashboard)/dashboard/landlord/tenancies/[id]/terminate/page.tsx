import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import TerminateForm from './TerminateForm';

export default async function TerminatePage({
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
      endDate: true,
      tenant: { select: { name: true } },
      room: { select: { label: true, property: { select: { address: true } } } },
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));
  if (tenancy.status !== 'ACTIVE') redirect(`/dashboard/landlord/tenancies/${id}`);

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
        <span className="text-white/70 font-medium">Serve Notice</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Serve Notice to Quit</h1>
        <p className="text-white/50 text-sm mt-1">
          Formally terminate this tenancy with {tenancy.tenant.name}. This action is recorded with a timestamp and cannot be undone.
        </p>
      </div>

      <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-xl px-5 py-4 mb-6">
        <p className="text-[#f87171] font-semibold text-sm">This is a legal notice of termination</p>
        <p className="text-[#f87171] text-xs mt-1 leading-relaxed">
          Ensure you have provided the required notice period as stated in the tenancy agreement before proceeding. The tenancy status will be changed to Terminated immediately.
        </p>
      </div>

      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
        <TerminateForm tenancyId={id} />
      </div>
    </div>
  );
}
