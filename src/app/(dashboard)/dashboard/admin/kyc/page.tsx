import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { AdminNav } from '@/components/ui/AdminTabBar';
import { PageHeader } from '@/components/ui/RedesignPrimitives';
import AdminKycActions from './AdminKycActions';


export default async function AdminKycPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard/admin');

  const submissions = await prisma.kycSubmission.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  return (
    <div className="max-w-4xl">
      <AdminNav active="kyc" />
      <PageHeader
        eyebrow="Admin"
        title="KYC Review"
        description="Review identity verification submissions. Compare the IC photos and selfie to approve or reject."
      />

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-12 text-center">
          <p className="font-semibold text-white/70">No pending submissions</p>
          <p className="mt-1 text-sm text-white/40">New KYC submissions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-5">
              <div className="mb-4">
                <p className="font-semibold text-white">{sub.user.name}</p>
                <p className="text-xs text-white/50">{sub.user.email}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {sub.user.role} · Submitted{' '}
                  {new Date(sub.submittedAt).toLocaleDateString('en-MY', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>

                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[
                    { url: sub.icFrontUrl, label: 'IC Front' },
                    { url: sub.icBackUrl, label: 'IC Back' },
                    { url: sub.selfieUrl, label: 'Selfie' },
                  ].map(({ url, label }) => (
                    <a key={label} href={url} target="_blank" rel="noreferrer" className="group block">
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[rgba(196,154,60,0.15)] bg-[#0f172a]">
                        <Image src={url} alt={label} fill className="object-cover group-hover:opacity-90 transition-opacity" sizes="200px" />
                      </div>
                      <p className="mt-1 text-center text-xs text-white/40">{label}</p>
                    </a>
                  ))}
                </div>

              <AdminKycActions submissionId={sub.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
