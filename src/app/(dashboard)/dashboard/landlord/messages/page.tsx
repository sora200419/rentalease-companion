import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import LandlordMessagesClient from '@/components/ui/LandlordMessagesClient';

export default async function LandlordMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  // Fetch all tenancies with message metadata.
  // The unread count per tenancy tells which conversations have
  // new activity so that can show badges in the sidebar.
  const tenancies = await prisma.tenancy.findMany({
    where: {
      room: { property: { landlordId: session.user.id } },
      status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
    },
    include: {
      room: {
        include: {
          property: { select: { address: true, city: true } },
        },
      },
      tenant: { select: { name: true } },
      // Count unread messages for this landlord in each tenancy
      messages: {
        where: { receiverId: session.user.id, read: false },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Shape the data for the client component.
  const tenancyList = tenancies.map((t) => ({
    id: t.id,
    propertyAddress: t.room.property.address,
    propertyCity: t.room.property.city,
    tenantName: t.tenant.name,
    unreadCount: t.messages.length,
    status: t.status,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/50 mt-1 text-sm">
          In-platform messaging with your tenants.
        </p>
      </div>

      {tenancyList.length === 0 ? (
        <div className="text-center py-20 bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)]">
          <svg className="w-12 h-12 text-white/20 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <p className="text-white/70 font-semibold text-lg">
            No tenancies yet
          </p>
          <p className="text-white/40 text-sm mt-1">
            Messaging will be available once you have tenancies with tenants.
          </p>
        </div>
      ) : (
        <LandlordMessagesClient
          tenancies={tenancyList}
          currentUserId={session.user.id}
        />
      )}
    </div>
  );
}
