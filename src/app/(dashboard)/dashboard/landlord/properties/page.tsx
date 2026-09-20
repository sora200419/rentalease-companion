import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import PropertyCover from '@/components/ui/PropertyCover';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/RedesignPrimitives';
import { getPropertyCover } from '@/lib/uiRedesign';

export default async function PropertiesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  const [properties, landlord] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId: session.user.id },
      include: {
        photos: {
          select: { imageUrl: true, caption: true, order: true, createdAt: true },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          take: 1,
        },
        rooms: {
          include: {
            tenancies: {
              where: { status: { in: ['INVITED', 'PENDING', 'ACTIVE'] } },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isVerified: true, icNumber: true },
    }),
  ]);

  const isVerified = landlord?.isVerified ?? false;
  const hasIc = !!landlord?.icNumber;
  const totalRooms = properties.reduce((sum, property) => sum + property.rooms.length, 0);
  const occupiedRooms = properties.reduce(
    (sum, property) => sum + property.rooms.filter((room) => room.tenancies.length > 0).length,
    0,
  );
  const pendingVerification = properties.filter((property) => !property.isVerified).length;

  return (
    <div>
      {!isVerified && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.08)] px-4 py-3 text-sm text-[#facc15]">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#facc15]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold">Account not yet verified</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#facc15]">
              {hasIc
                ? <>Complete identity verification on your{' '}<Link href="/dashboard/kyc" className="font-medium underline">KYC page</Link>{' '}before adding properties.</>
                : <>Add your IC number on your{' '}<Link href="/dashboard/profile" className="font-medium underline">Profile page</Link>{' '}then complete identity verification before adding properties.</>
              }
            </p>
          </div>
        </div>
      )}

      <PageHeader
        eyebrow="Property portfolio"
        title="Properties"
        description={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'} in your portfolio`}
        action={
          isVerified && (
            <Link
              href="/dashboard/landlord/properties/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              Add Property
            </Link>
          )
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Properties" value={properties.length} tone="blue" />
        <StatCard label="Rooms" value={totalRooms} />
        <StatCard label="Occupied" value={occupiedRooms} detail={`${totalRooms - occupiedRooms} available`} tone="green" />
        <StatCard
          label="Pending verification"
          value={pendingVerification}
          tone={pendingVerification > 0 ? 'amber' : 'default'}
        />
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description={
            isVerified
              ? 'Add your first property to start building your RentalEase portfolio.'
              : 'Complete identity verification to start adding properties.'
          }
          action={
            isVerified && (
              <Link
                href="/dashboard/landlord/properties/new"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Add Property
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const cover = getPropertyCover(property.photos);
            const propertyTotalRooms = property.rooms.length;
            const propertyOccupiedRooms = property.rooms.filter((r) => r.tenancies.length > 0).length;
            const fullyOccupied = propertyTotalRooms > 0 && propertyOccupiedRooms === propertyTotalRooms;
            const hasVacancy = propertyTotalRooms > 0 && propertyOccupiedRooms < propertyTotalRooms;
            const noRooms = propertyTotalRooms === 0;

            const occupancyLabel = fullyOccupied
              ? 'Fully occupied'
              : noRooms
              ? 'No rooms'
              : hasVacancy
              ? `${propertyOccupiedRooms}/${propertyTotalRooms} occupied`
              : 'Vacant';

            const occupancyPill = fullyOccupied
              ? 'bg-[rgba(74,222,128,0.12)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.3)] ring-inset'
              : noRooms
              ? 'bg-white/8 text-white/40 ring-1 ring-[rgba(196,154,60,0.15)] ring-inset'
              : hasVacancy
              ? 'bg-[rgba(251,191,36,0.08)] text-[#facc15] ring-1 ring-[rgba(251,191,36,0.25)] ring-inset'
              : 'bg-white/8 text-white/50 ring-1 ring-[rgba(196,154,60,0.15)] ring-inset';

            return (
              <article key={property.id} className="overflow-hidden rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] transition-colors hover:border-[rgba(196,154,60,0.3)]">
                <div className="relative">
                  <PropertyCover
                    address={property.address}
                    imageUrl={cover?.imageUrl}
                    caption={cover?.caption}
                    className="rounded-t-xl"
                    heightClassName="h-44"
                  />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${occupancyPill}`}>
                      {occupancyLabel}
                    </span>
                    {!property.isVerified && (
                      <span className="inline-flex items-center rounded-full bg-[rgba(251,191,36,0.08)] px-2.5 py-1 text-xs font-semibold text-[#facc15] ring-1 ring-[rgba(251,191,36,0.25)] ring-inset">
                        Pending verification
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  {!property.isVerified && (
                    <div className="mb-3 rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.08)] px-3 py-2">
                      <p className="text-xs font-medium text-[#facc15]">Pending admin verification</p>
                    </div>
                  )}

                  <p className="text-sm font-semibold leading-snug text-white">{property.address}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {property.city}, {property.state} {property.postcode}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-white/50">
                    <span className="capitalize">{property.type}</span>
                    <span>{propertyTotalRooms} {propertyTotalRooms === 1 ? 'room' : 'rooms'}</span>
                  </div>

                  <div className="mt-4 border-t border-[rgba(196,154,60,0.12)] pt-4">
                    <Link
                      href={`/dashboard/landlord/properties/${property.id}`}
                      className="block rounded-lg py-1.5 text-center text-sm font-medium text-[#C49A3C] transition-colors hover:bg-[rgba(196,154,60,0.1)] hover:text-[#E8B84B]"
                    >
                      {noRooms ? 'Add Rooms' : 'Manage'}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
