import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ConditionReportCard from '@/components/ui/ConditionReportCard';
import ConditionPhotoUploader from '@/components/ui/ConditionPhotoUploader';
import CreateConditionReport from '@/components/ui/CreateConditionReport';
import ConditionChecklistEditor from '@/components/ui/ConditionChecklistEditor';
import {
  buildTenantConditionReviewTenancyQuery,
  buildTenantConditionTenancyQuery,
} from '@/lib/conditionReports';
import {
  canReviewConditionReport,
  isConditionReportLocked,
} from '@/lib/conditionReportWorkflow';

export default async function TenantConditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenancyId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'TENANT') redirect('/login');

  const { tenancyId } = await searchParams;
  const tenancy =
    (tenancyId
      ? await prisma.tenancy.findFirst(
          buildTenantConditionTenancyQuery(session.user.id, tenancyId),
        )
      : await prisma.tenancy.findFirst(
          buildTenantConditionReviewTenancyQuery(session.user.id),
        )) ??
    (tenancyId
      ? null
      : await prisma.tenancy.findFirst(
          buildTenantConditionTenancyQuery(session.user.id),
        ));

  if (!tenancy) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            Property Condition
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            Document and track property condition for your tenancy.
          </p>
        </div>
        <div className="text-center py-20 bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)]">
          <svg className="w-12 h-12 text-white/20 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-white/70 font-semibold text-lg">
            No active tenancy
          </p>
          <p className="text-white/40 text-sm mt-1">
            Condition reports will be available once your landlord links you to
            a tenancy.
          </p>
        </div>
      </div>
    );
  }

  const reports = await prisma.conditionReport.findMany({
    where: { tenancyId: tenancy.id },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      reviewedBy: { select: { id: true, name: true } },
      photos: {
        select: { id: true, room: true, imageUrl: true, caption: true, uploadedById: true },
        orderBy: { createdAt: 'asc' },
      },
      checklistItems: { orderBy: { area: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const moveInExists = reports.some((r) => r.type === 'MOVE_IN');
  const moveOutExists = reports.some((r) => r.type === 'MOVE_OUT');
  const canCompare = moveInExists && moveOutExists;

  const pendingAck = reports.filter(
    (r) =>
      canReviewConditionReport({
        status: r.status,
        createdById: r.createdBy.id,
        reviewedById: r.reviewedById,
        currentUserId: session.user.id,
      }),
  ).length;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">
            Property Condition
          </h1>
          {/* Phase 10 fix: address is now at tenancy.room.property.address */}
          <p className="text-white/50 text-sm mt-1">
            {tenancy.room.property.address}, {tenancy.room.property.city}{' '}
            &middot; Landlord: {tenancy.room.property.landlord.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          {pendingAck > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingAck} to review
            </span>
          )}
          {canCompare && (
            <Link
              href={`/dashboard/tenant/conditions/compare?tenancyId=${encodeURIComponent(tenancy.id)}`}
              className="inline-flex shrink-0 items-center whitespace-nowrap text-sm font-medium px-4 py-2 rounded-lg border border-[rgba(196,154,60,0.2)] text-white/70 hover:bg-white/5 transition-colors bg-[#1C2740]"
            >
              Compare Move-In vs Move-Out
            </Link>
          )}
          <CreateConditionReport tenancyId={tenancy.id} tenancyStatus={tenancy.status} />
        </div>
      </div>

      <div className="bg-[rgba(196,154,60,0.08)] border border-[rgba(196,154,60,0.25)] rounded-xl px-5 py-4 mb-6">
        <p className="text-[#C49A3C] text-sm font-medium">
          Protect yourself with photo evidence
        </p>
        <p className="text-[#C49A3C]/70 text-xs mt-1">
          Upload photos to document the property condition when you move in.
          This evidence protects your security deposit — if there&apos;s a
          dispute at move-out, you can compare photos from both dates.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-20 bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)]">
          <svg className="w-12 h-12 text-white/20 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-white/70 font-semibold text-lg">
            No condition reports yet
          </p>
          <p className="text-white/40 text-sm mt-1 max-w-sm mx-auto">
            Create a move-in report to document the property&apos;s condition
            before you settle in. Your landlord may also create one.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => {
            const isLocked = isConditionReportLocked(report.status);
            const isCreator = report.createdBy.id === session.user.id;
            const showChecklist = isCreator && ['DRAFT', 'CORRECTION_REQUESTED'].includes(report.status) && report.type !== 'INSPECTION';
            return (
              <div key={report.id} className="space-y-3">
                <ConditionReportCard
                  reportId={report.id}
                  type={report.type as 'MOVE_IN' | 'MOVE_OUT' | 'INSPECTION'}
                  status={report.status}
                  notes={report.notes}
                  correctionNote={report.correctionNote}
                  counterNote={report.counterNote}
                  createdAt={report.createdAt.toISOString()}
                  createdByName={report.createdBy.name}
                  createdByRole={report.createdBy.role}
                  createdById={report.createdBy.id}
                  reviewedAt={report.reviewedAt?.toISOString() ?? null}
                  reviewedById={report.reviewedById}
                  reviewedByName={report.reviewedBy?.name ?? null}
                  photos={report.photos}
                  checklistItems={report.checklistItems.map((i) => ({
                    area: i.area,
                    completionReason: i.completionReason,
                  }))}
                  currentUserId={session.user.id}
                />
                {!isLocked && <ConditionPhotoUploader reportId={report.id} />}
                {showChecklist && (
                  <ConditionChecklistEditor
                    reportId={report.id}
                    existingItems={report.checklistItems.map((i) => ({
                      area: i.area,
                      completionReason: i.completionReason as 'PHOTO_UPLOADED' | 'NO_ISSUE_OBSERVED' | 'NOT_APPLICABLE' | 'CANNOT_ACCESS',
                    }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
