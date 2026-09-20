import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ProfileForm from '@/components/ui/ProfileForm';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  // Fetch the full user record — we need icNumber, phone, name for pre-filling the form
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      icNumber: true,
      isVerified: true,
      role: true,
      createdAt: true,
    },
  });

  const kycSubmission = await prisma.kycSubmission.findUnique({
    where: { userId: session.user.id },
    select: { status: true, rejectedReason: true },
  });

  if (!user) redirect('/login');

  // Count how many agreements this user is a party to — shown as context
  // so the user understands why their IC matters for the platform
  const agreementCount =
    user.role === 'TENANT'
      ? await prisma.agreement.count({
          where: { tenancy: { tenantId: user.id } },
        })
      : await prisma.agreement.count({
          where: {
            tenancy: { room: { property: { landlordId: user.id } } },
          },
        });

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const isVerified = user.isVerified;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-white/50 mt-1 text-sm">
          Manage your personal information and identity verification.
        </p>
      </div>

      {/* Account overview card — read-only summary for context */}
      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6 mb-6">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">
          Account Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-white/40">Member Since</p>
            <p className="font-medium text-white mt-0.5">
              {formatDate(user.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-white/40">Role</p>
            <p className="font-medium text-white mt-0.5 capitalize">
              {user.role.toLowerCase()}
            </p>
          </div>
          <div>
            <p className="text-white/40">Agreements</p>
            <p className="font-medium text-white mt-0.5">
              {agreementCount}{' '}
              {agreementCount === 1 ? 'agreement' : 'agreements'}
            </p>
          </div>
          <div>
            <p className="text-white/40">Verification</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className={`font-medium ${
                isVerified ? 'text-[#4ade80]'
                : kycSubmission?.status === 'PENDING' ? 'text-[#C49A3C]'
                : kycSubmission?.status === 'REJECTED' ? 'text-[#f87171]'
                : 'text-[#E8B84B]'
              }`}>
                {isVerified ? 'Verified'
                  : kycSubmission?.status === 'PENDING' ? 'Under review'
                  : kycSubmission?.status === 'REJECTED' ? 'Rejected'
                  : 'Not started'}
              </p>
              {!isVerified && !kycSubmission && (
                <a href="/dashboard/kyc" className="text-xs text-[#C49A3C] hover:text-[#E8B84B] transition-colors font-medium">
                  Verify now →
                </a>
              )}
              {kycSubmission?.status === 'REJECTED' && (
                <a href="/dashboard/kyc" className="text-xs text-[#f87171] hover:text-[#fca5a5] transition-colors font-medium">
                  Resubmit →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile edit form */}
      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-6">
        <ProfileForm
          initialName={user.name}
          initialPhone={user.phone}
          initialIcNumber={user.icNumber}
          kycStatus={kycSubmission?.status ?? null}
          email={user.email}
          role={user.role}
        />
      </div>

    </div>
  );
}
