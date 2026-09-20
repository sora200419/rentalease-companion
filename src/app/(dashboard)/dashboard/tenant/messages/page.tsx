import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import MessageThread from '@/components/ui/MessageThread';

export default async function TenantMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'TENANT') redirect('/login');

  const tenancy = await prisma.tenancy.findFirst({
    where: {
      tenantId: session.user.id,
      status: { in: ['PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
    },
    include: {
      room: {
        include: {
          property: {
            include: {
              landlord: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/50 mt-1 text-sm">
          Communication with your landlord for your tenancy.
        </p>
      </div>

      {!tenancy ? (
        <div className="text-center py-20 bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)]">
          <svg className="w-12 h-12 text-white/20 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-white/70 font-semibold text-lg">
            No active tenancy
          </p>
          <p className="text-white/40 text-sm mt-1">
            Messaging will be available once your landlord links you to a
            tenancy.
          </p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="mb-3 px-1">
            {/* Phase 10 fix: address is now at tenancy.room.property.address */}
            <p className="text-sm text-white/60">
              <span className="font-medium">
                {tenancy.room.property.address}
              </span>
              {' · '}Landlord: {tenancy.room.property.landlord.name}
            </p>
          </div>
          <MessageThread
            tenancyId={tenancy.id}
            currentUserId={session.user.id}
            otherPartyName={tenancy.room.property.landlord.name}
          />
        </div>
      )}
    </div>
  );
}
