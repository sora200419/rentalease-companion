// src/components/ui/ConditionComparisonView.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  getMoveInBaselineWarning,
  type ComparisonResult,
  type RoomGroup,
  type ComparisonPhoto,
} from '@/lib/compareConditionReports'

type ReportSummary = {
  createdAt: string
  createdByName: string
  status: string
  photoCount: number
}

type Props = {
  moveInReport: ReportSummary
  moveOutReport: ReportSummary
  comparison: ComparisonResult
  backHref: string
  propertyLabel: string
  tenantName: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT:                  { label: 'Draft',               className: 'bg-white/5 text-white/60' },
  SUBMITTED:              { label: 'Submitted',           className: 'bg-[rgba(196,154,60,0.1)] text-[#C49A3C]' },
  PENDING_REVIEW:         { label: 'Pending Review',      className: 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B]' },
  CORRECTION_REQUESTED:   { label: 'Correction Requested', className: 'bg-orange-100 text-orange-700' },
  COUNTER_EVIDENCE_ADDED: { label: 'Counter Evidence',    className: 'bg-purple-100 text-purple-700' },
  ACCEPTED:               { label: 'Accepted',            className: 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]' },
  DISPUTED:               { label: 'Disputed',            className: 'bg-[rgba(248,113,113,0.1)] text-[#f87171]' },
  LOCKED:                 { label: 'Locked',              className: 'bg-white/10 text-white/70' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, className: 'bg-white/5 text-white/60' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function PhotoGrid({ photos }: { photos: ComparisonPhoto[] }) {
  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 rounded-lg bg-white/[0.03] border border-dashed border-[rgba(196,154,60,0.15)]">
        <p className="text-xs text-white/40">Not documented</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id}>
          <div className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
            <Image
              src={photo.imageUrl}
              alt={photo.caption ?? 'Condition photo'}
              fill
              className="object-cover"
              sizes="120px"
            />
          </div>
          {photo.caption && (
            <p className="text-[10px] text-white/40 mt-1 text-center truncate">
              {photo.caption}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function RoomCard({ group }: { group: RoomGroup }) {
  return (
    <div className="bg-[#1C2740] border border-[rgba(196,154,60,0.15)] rounded-xl overflow-hidden">
      <div className="bg-white/[0.03] border-b border-[rgba(196,154,60,0.15)] px-4 py-2.5 flex items-center gap-2">
        <span className="text-sm font-semibold text-white/70">{group.roomLabel}</span>
        <span className="text-xs text-white/40">
          · {group.moveInPhotos.length} move-in · {group.moveOutPhotos.length} move-out
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[rgba(255,255,255,0.06)]">
        <div className="p-4">
          <PhotoGrid photos={group.moveInPhotos} />
        </div>
        <div className="p-4">
          <PhotoGrid photos={group.moveOutPhotos} />
        </div>
      </div>
    </div>
  )
}

export default function ConditionComparisonView({
  moveInReport,
  moveOutReport,
  comparison,
  backHref,
  propertyLabel,
  tenantName,
}: Props) {
  const { matched, moveInOnly, moveOutOnly } = comparison
  const isEmpty = matched.length === 0 && moveInOnly.length === 0 && moveOutOnly.length === 0
  const baselineWarning = getMoveInBaselineWarning(moveInReport.status)

  return (
    <div className="max-w-4xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-[#C49A3C] mb-6 transition-colors"
      >
        ← Back to Condition Reports
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Move-In vs Move-Out</h1>
        <p className="text-white/50 text-sm mt-1">
          {propertyLabel} · Tenant: {tenantName}
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1C2740] border border-[rgba(196,154,60,0.15)] rounded-xl px-5 py-4 border-l-4 border-l-blue-500">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Move-In</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {new Date(moveInReport.createdAt).toLocaleDateString('en-MY', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <StatusBadge status={moveInReport.status} />
          </div>
          <p className="text-xs text-white/50 mt-1">
            By {moveInReport.createdByName} · {moveInReport.photoCount}{' '}
            {moveInReport.photoCount === 1 ? 'photo' : 'photos'}
          </p>
        </div>

        <div className="bg-[#1C2740] border border-[rgba(196,154,60,0.15)] rounded-xl px-5 py-4 border-l-4 border-l-amber-400">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-1">Move-Out</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {new Date(moveOutReport.createdAt).toLocaleDateString('en-MY', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
            <StatusBadge status={moveOutReport.status} />
          </div>
          <p className="text-xs text-white/50 mt-1">
            By {moveOutReport.createdByName} · {moveOutReport.photoCount}{' '}
            {moveOutReport.photoCount === 1 ? 'photo' : 'photos'}
          </p>
        </div>
      </div>

      {baselineWarning && (
        <div className="mb-6 rounded-xl border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-5 py-4">
          <p className="text-sm font-semibold text-[#f87171]">
            {baselineWarning.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[#f87171]">
            {baselineWarning.message}
          </p>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-20 bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)]">
          <p className="text-white/70 font-semibold text-lg">No photos to compare</p>
          <p className="text-white/40 text-sm mt-1">
            Neither report has any photos uploaded yet.
          </p>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-2 gap-4 px-1 mb-2">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-500">← Move-In Photos</p>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-500">Move-Out Photos →</p>
          </div>

          {/* Matched rooms */}
          {matched.length > 0 && (
            <div className="space-y-3 mb-6">
              {matched.map((group) => (
                <RoomCard key={group.roomLabel} group={group} />
              ))}
            </div>
          )}

          {/* Move-in only */}
          {moveInOnly.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
                Move-In only (no matching move-out room)
              </p>
              <div className="space-y-3">
                {moveInOnly.map((group) => (
                  <RoomCard key={group.roomLabel} group={group} />
                ))}
              </div>
            </div>
          )}

          {/* Move-out only */}
          {moveOutOnly.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40 mb-2">
                Move-Out only (no matching move-in room)
              </p>
              <div className="space-y-3">
                {moveOutOnly.map((group) => (
                  <RoomCard key={group.roomLabel} group={group} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
