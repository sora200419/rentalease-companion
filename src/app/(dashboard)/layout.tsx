import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import KycPendingBanner from '@/components/ui/KycPendingBanner';
import DashboardShell from '@/components/ui/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  let isVerified = true;
  let kycState: 'none' | 'PENDING' | 'REJECTED' = 'none';
  let rejectedReason: string | null = null;

  if (session.user.role !== 'ADMIN') {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        isVerified: true,
        kycSubmission: { select: { status: true, rejectedReason: true } },
      },
    });
    isVerified = user?.isVerified ?? false;
    const sub = user?.kycSubmission;
    if (sub?.status === 'PENDING') kycState = 'PENDING';
    else if (sub?.status === 'REJECTED') { kycState = 'REJECTED'; rejectedReason = sub.rejectedReason ?? null; }
  }

  return (
    <DashboardShell>
      {!isVerified && (
        <KycPendingBanner role={session.user.role} kycState={kycState} rejectedReason={rejectedReason} />
      )}
      {children}
    </DashboardShell>
  );
}
