import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader, StatCard } from '@/components/ui/RedesignPrimitives';
import { AdminNav } from '@/components/ui/AdminTabBar';
import SuspendButton from '@/components/ui/SuspendButton';
import DeleteUserButton from '@/components/ui/DeleteUserButton';

function getKycBadge(isVerified: boolean, kycStatus: string | null) {
  if (isVerified) return { label: 'Verified', cls: 'bg-[rgba(74,222,128,0.12)] text-[#4ade80]' };
  if (kycStatus === 'PENDING') return { label: 'Pending', cls: 'bg-[rgba(250,204,21,0.12)] text-[#facc15]' };
  if (kycStatus === 'REJECTED') return { label: 'Rejected', cls: 'bg-[rgba(248,113,113,0.12)] text-[#f87171]' };
  return { label: 'Unverified', cls: 'bg-white/8 text-white/50' };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard/admin');

  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const roleFilter = params.role ?? 'all';
  const safeRole = (['LANDLORD', 'TENANT'] as const).find((r) => r === params.role) ?? null;
  const statusFilter = params.status ?? 'all';

  const where = {
    role: safeRole ?? { not: 'ADMIN' as const },
    ...(statusFilter === 'suspended' && { isSuspended: true }),
    ...(statusFilter === 'active' && { isSuspended: false }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [users, totalCount, suspendedCount, landlordCount, tenantCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        isSuspended: true,
        deletedAt: true,
        deletedReason: true,
        createdAt: true,
        kycSubmission: { select: { status: true } },
        ownedProperties: {
          where: { isVerified: true },
          select: { id: true },
        },
        tenancies: {
          where: { status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] } },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
    prisma.user.count({ where: { role: { not: 'ADMIN' }, isSuspended: true } }),
    prisma.user.count({ where: { role: 'LANDLORD' } }),
    prisma.user.count({ where: { role: 'TENANT' } }),
  ]);

  return (
    <div className="max-w-5xl">
      <AdminNav active="users" />

      <PageHeader
        eyebrow="Admin"
        title="User Management"
        description="View, suspend, and remove user accounts."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total users" value={totalCount} />
        <StatCard label="Suspended" value={suspendedCount} tone={suspendedCount > 0 ? 'amber' : 'default'} />
        <StatCard label="Breakdown" value={`${landlordCount}L · ${tenantCount}T`} />
      </div>

      <form method="GET" className="mb-6 grid gap-3 rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-4 md:grid-cols-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          className="bg-white/5 border border-[rgba(196,154,60,0.2)] text-white rounded-lg px-3 py-2 text-sm focus:border-[rgba(196,154,60,0.5)] focus:outline-none placeholder:text-white/30"
        />
        <select
          name="role"
          defaultValue={roleFilter}
          className="bg-white/5 border border-[rgba(196,154,60,0.2)] text-white rounded-lg px-3 py-2 text-sm focus:border-[rgba(196,154,60,0.5)] focus:outline-none"
        >
          <option value="all">All roles</option>
          <option value="LANDLORD">Landlord</option>
          <option value="TENANT">Tenant</option>
        </select>
        <select
          name="status"
          defaultValue={statusFilter}
          className="bg-white/5 border border-[rgba(196,154,60,0.2)] text-white rounded-lg px-3 py-2 text-sm focus:border-[rgba(196,154,60,0.5)] focus:outline-none"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 md:col-span-3"
        >
          Filter
        </button>
      </form>

      {users.length === 0 ? (
        <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-12 text-center">
          <p className="text-base font-semibold text-white/70">No users found</p>
          <p className="mt-1 text-sm text-white/40">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const kyc = getKycBadge(user.isVerified, user.kycSubmission?.status ?? null);
            const activityCount =
              user.role === 'LANDLORD'
                ? user.ownedProperties.length
                : user.tenancies.length;
            const activityLabel =
              user.role === 'LANDLORD'
                ? `${activityCount} active propert${activityCount !== 1 ? 'ies' : 'y'}`
                : `${activityCount} tenanc${activityCount !== 1 ? 'ies' : 'y'}`;

            return (
              <div
                key={user.id}
                className={`rounded-xl border bg-[#1C2740] p-4 ${user.isSuspended ? 'border-[rgba(248,113,113,0.25)]' : 'border-[rgba(196,154,60,0.15)]'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          user.role === 'LANDLORD'
                            ? 'bg-[rgba(196,154,60,0.08)] text-[#C49A3C]'
                            : 'bg-[rgba(74,222,128,0.12)] text-[#4ade80]'
                        }`}
                      >
                        {user.role === 'LANDLORD' ? 'Landlord' : 'Tenant'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${kyc.cls}`}>
                        {kyc.label}
                      </span>
                      {user.isSuspended && (
                        <span className="rounded-full bg-[rgba(248,113,113,0.12)] px-2 py-0.5 text-xs font-semibold text-[#f87171]">
                          Suspended
                        </span>
                      )}
                      {user.deletedAt && (
                        <span className="rounded-full bg-[rgba(248,113,113,0.2)] px-2 py-0.5 text-xs font-semibold text-[#f87171]">
                          Deleted
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/50">{user.email}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {activityLabel} · Joined {new Date(user.createdAt).toLocaleDateString('en-MY')}
                    </p>
                  </div>
                  {!user.deletedAt && (
                    <div className="flex shrink-0 items-center gap-2">
                      <SuspendButton
                        userId={user.id}
                        userName={user.name}
                        isSuspended={user.isSuspended}
                      />
                      <DeleteUserButton userId={user.id} userName={user.name} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
