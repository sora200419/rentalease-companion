import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import AddRoomForm from '@/components/ui/AddRoomForm';
import PropertyPhotoUploader from '@/components/ui/PropertyPhotoUploader';
import PropertyPhotoGallery from '@/components/ui/PropertyPhotoGallery';
import DeletePropertyButton from '@/components/ui/DeletePropertyButton';
import DeleteRoomButton from '@/components/ui/DeleteRoomButton';
import PropertyCover from '@/components/ui/PropertyCover';
import { PageHeader, SectionCard, StatCard } from '@/components/ui/RedesignPrimitives';
import { getOccupancySummary, getPropertyCover } from '@/lib/uiRedesign';

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  const { id } = await params;

  const property = await prisma.property.findFirst({
    where: { id, landlordId: session.user.id },
    include: {
      photos: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      rooms: {
        include: {
          tenancies: {
            where: { status: { in: ['INVITED', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED'] } },
            include: {
              tenant: { select: { name: true, email: true } },
              agreement: { select: { status: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!property) notFound();

  const formatRM = (amount: unknown) =>
    `RM ${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const ACTIVE_STATUSES = ['INVITED', 'PENDING', 'ACTIVE'] as const;
  const totalRooms = property.rooms.length;
  const occupiedRooms = property.rooms.filter((r) => {
    const t = r.tenancies[0] ?? null;
    return t !== null && (ACTIVE_STATUSES as readonly string[]).includes(t.status);
  }).length;

  const cover = getPropertyCover(property.photos);
  const occupancy = getOccupancySummary({ totalRooms, occupiedRooms });

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Property detail"
        title={property.address}
        description={`${property.city}, ${property.state} ${property.postcode}`}
        action={<DeletePropertyButton propertyId={property.id} propertyAddress={property.address} />}
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740]">
        <PropertyCover
          address={property.address}
          imageUrl={cover?.imageUrl}
          caption={cover?.caption}
          className="rounded-none border-0"
          heightClassName="h-64"
        />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <StatCard label="Property type" value={property.type} />
          <StatCard
            label="Occupancy"
            value={occupancy.label}
            tone={occupancy.tone === 'success' ? 'green' : occupancy.tone === 'warning' ? 'amber' : 'default'}
          />
          <StatCard label="Rooms" value={totalRooms} />
        </div>
      </div>

      <div className="space-y-5">
        <SectionCard title="Property photos">
          <PropertyPhotoGallery propertyId={property.id} photos={property.photos} />
          <div className="mt-4 border-t border-[rgba(196,154,60,0.1)] pt-4">
            <p className="mb-3 text-xs font-medium text-white/50">Add a photo</p>
            <PropertyPhotoUploader propertyId={property.id} />
          </div>
        </SectionCard>

        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
            Property Details
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40">Type</p>
              <p className="font-medium text-white mt-0.5">
                {property.type}
              </p>
            </div>
            {property.description && (
              <div className="col-span-2">
                <p className="text-white/40">Description</p>
                <p className="font-medium text-white mt-0.5">
                  {property.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">
              Rooms ({totalRooms})
            </h2>
            {totalRooms === 0 && (
              <p className="text-xs text-[#E8B84B] font-medium">
                Add at least one room to create tenancies
              </p>
            )}
          </div>

          {totalRooms === 0 && (
            <div className="text-center py-6 mb-5">
              <svg className="w-8 h-8 text-white/30 mb-2 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              <p className="text-white/60 font-medium text-sm">
                No rooms added yet
              </p>
              <p className="text-white/40 text-xs mt-1">
                Add &ldquo;Entire Unit&rdquo; for a single-tenant let, or
                individual rooms for room-by-room rentals.
              </p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2 mb-5">
            {property.rooms.map((room) => {
              const currentTenancy = room.tenancies[0] ?? null;
              const isOccupied = currentTenancy !== null && (ACTIVE_STATUSES as readonly string[]).includes(currentTenancy.status);

              return (
                <div
                  key={room.id}
                  className={`border rounded-xl p-5 ${isOccupied ? 'border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)]' : 'border-[rgba(196,154,60,0.15)] bg-[#1C2740]'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">
                        {room.label}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {room.bathrooms} bathroom
                        {room.bathrooms > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#C49A3C] font-bold">
                        {formatRM(room.rentAmount)}
                      </p>
                      <p className="text-xs text-white/40">/month</p>
                    </div>
                  </div>

                  {isOccupied && currentTenancy ? (
                    <div className="bg-[#1C2740] rounded-lg border border-[rgba(74,222,128,0.25)] p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-[rgba(196,154,60,0.1)] flex items-center justify-center text-xs font-bold text-[#C49A3C]">
                          {currentTenancy.tenant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {currentTenancy.tenant.name}
                          </p>
                          <p className="text-xs text-white/40">
                            {currentTenancy.tenant.email}
                          </p>
                        </div>
                        <span
                          className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                            currentTenancy.status === 'ACTIVE'
                              ? 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]'
                              : currentTenancy.status === 'INVITED'
                                ? 'bg-[rgba(196,154,60,0.1)] text-[#C49A3C]'
                                : 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]'
                          }`}
                        >
                          {currentTenancy.status.charAt(0) +
                            currentTenancy.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/landlord/tenancies/${currentTenancy.id}`}
                        className="text-xs text-[#C49A3C] hover:underline font-medium"
                      >
                        View Tenancy →
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/40 font-medium">
                          Vacant
                        </span>
                        {currentTenancy && (
                          <Link
                            href={`/dashboard/landlord/tenancies/${currentTenancy.id}`}
                            className="text-xs text-white/40 hover:text-[#C49A3C] transition-colors"
                          >
                            View last tenancy →
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <DeleteRoomButton roomId={room.id} roomLabel={room.label} />
                        <Link
                          href={`/dashboard/landlord/tenancies/new?roomId=${room.id}`}
                          className="bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.25)] hover:opacity-90 text-[#4ade80] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          + Create Tenancy
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <AddRoomForm propertyId={property.id} />
        </div>
      </div>
    </div>
  );
}
