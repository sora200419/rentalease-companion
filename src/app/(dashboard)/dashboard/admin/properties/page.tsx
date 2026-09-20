import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import VerifyPropertyButton from '@/components/ui/VerifyPropertyButton';
import RevokeButton from '@/components/ui/RevokeButton';
import AdminTabBar from '@/components/ui/AdminTabBar';
import PropertyCover from '@/components/ui/PropertyCover';
import { PageHeader } from '@/components/ui/RedesignPrimitives';

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/login');

  const { tab } = await searchParams;
  const activeTab = tab === 'verified' ? 'verified' : 'pending';

  const [unverifiedProperties, verifiedCount] = await Promise.all([
    prisma.property.findMany({
      where: { isVerified: false },
      include: {
        landlord: { select: { name: true, email: true, icNumber: true, isVerified: true } },
        rooms: { select: { id: true } },
        photos: { select: { imageUrl: true, caption: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.property.count({ where: { isVerified: true } }),
  ]);

  const verifiedProperties =
    activeTab === 'verified'
      ? await prisma.property.findMany({
          where: { isVerified: true },
          include: {
            landlord: { select: { name: true, email: true, icNumber: true, isVerified: true } },
            rooms: { select: { id: true } },
            photos: { select: { imageUrl: true, caption: true }, orderBy: { order: 'asc' } },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

  const displayProperties = activeTab === 'pending' ? unverifiedProperties : verifiedProperties;

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Admin"
        title="Property Verification"
        description="Review and approve property listings before landlords can invite tenants."
      />

      <AdminTabBar
        activeTab={activeTab}
        pendingCount={unverifiedProperties.length}
        verifiedCount={verifiedCount}
      />

      {displayProperties.length === 0 ? (
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.08)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-white/70 font-semibold">
            {activeTab === 'pending' ? 'All properties are verified' : 'No verified properties yet'}
          </p>
          <p className="text-sm text-white/40 mt-1">
            {activeTab === 'pending'
              ? 'No pending property approvals.'
              : 'Approved properties will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayProperties.map((property) => {
            const wasRejected = !!property.rejectedReason;
            return (
              <div
                key={property.id}
                className={`grid gap-4 rounded-xl border bg-[#1C2740] p-4 lg:grid-cols-[160px_1fr_auto] ${
                  wasRejected && activeTab === 'pending' ? 'border-[rgba(248,113,113,0.25)]' : 'border-[rgba(196,154,60,0.15)]'
                }`}
              >
                  <PropertyCover
                    address={property.address}
                    imageUrl={property.photos[0]?.imageUrl}
                    caption={property.photos[0]?.caption}
                    heightClassName="h-32 lg:h-full"
                    className="rounded-xl"
                  />
                  <div className="flex-1 min-w-0 p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white text-sm">{property.address}</p>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/8 text-white/50">
                        {property.type}
                      </span>
                      {wasRejected && activeTab === 'pending' && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[rgba(248,113,113,0.12)] text-[#f87171]">
                          Previously rejected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">
                      {property.city}, {property.state} {property.postcode}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {property.rooms.length} room{property.rooms.length !== 1 ? 's' : ''} &middot; Listed{' '}
                      {new Date(property.createdAt).toLocaleDateString('en-MY', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>

                    <div className="mt-2 pt-2 border-t border-[rgba(196,154,60,0.12)]">
                      <p className="text-xs text-white/60 font-medium">
                        Landlord: {property.landlord.name}
                      </p>
                      <p className="text-xs text-white/40">{property.landlord.email}</p>
                      {property.landlord.icNumber && (
                        <p className="text-xs text-white/40">IC: {property.landlord.icNumber}</p>
                      )}
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${
                          property.landlord.isVerified
                            ? 'bg-[rgba(74,222,128,0.12)] text-[#4ade80]'
                            : 'bg-[rgba(250,204,21,0.12)] text-[#facc15]'
                        }`}
                      >
                        Landlord {property.landlord.isVerified ? 'Identity Verified' : 'Identity Pending'}
                      </span>
                    </div>

                    {wasRejected && activeTab === 'pending' && (
                      <div className="mt-2 bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-[#f87171] mb-0.5">Previous rejection reason</p>
                        <p className="text-xs text-[#f87171]">{property.rejectedReason}</p>
                      </div>
                    )}

                    {property.photos.length > 1 && (
                      <div className="mt-3 flex gap-1.5">
                        {property.photos.slice(1, 5).map((photo, i) => (
                          <img
                            key={i}
                            src={photo.imageUrl}
                            alt={photo.caption ?? `Photo ${i + 2}`}
                            className="h-12 w-16 rounded object-cover flex-shrink-0"
                          />
                        ))}
                        {property.photos.length > 5 && (
                          <div className="h-12 w-16 rounded bg-white/8 flex items-center justify-center text-xs text-white/50 font-medium flex-shrink-0">
                            +{property.photos.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 p-5 flex items-start">
                    {activeTab === 'pending' ? (
                      <VerifyPropertyButton propertyId={property.id} />
                    ) : (
                      <RevokeButton revokeUrl={`/api/admin/properties/${property.id}/revoke`} />
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
