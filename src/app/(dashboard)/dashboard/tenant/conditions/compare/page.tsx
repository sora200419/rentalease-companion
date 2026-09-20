// src/app/(dashboard)/dashboard/tenant/conditions/compare/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ConditionComparisonView from '@/components/ui/ConditionComparisonView'
import { groupPhotosForComparison } from '@/lib/compareConditionReports'
import { buildTenantConditionTenancyQuery } from '@/lib/conditionReports'

export default async function TenantCompareConditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenancyId?: string }>;
}) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'TENANT') redirect('/login')

  const { tenancyId } = await searchParams
  const tenancy = await prisma.tenancy.findFirst(
    buildTenantConditionTenancyQuery(session.user.id, tenancyId),
  )

  if (!tenancy) notFound()

  const [moveInReport, moveOutReport] = await Promise.all([
    prisma.conditionReport.findFirst({
      where: { tenancyId: tenancy.id, type: 'MOVE_IN' },
      include: {
        createdBy: { select: { name: true } },
        photos: {
          select: { id: true, room: true, imageUrl: true, caption: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.conditionReport.findFirst({
      where: { tenancyId: tenancy.id, type: 'MOVE_OUT' },
      include: {
        createdBy: { select: { name: true } },
        photos: {
          select: { id: true, room: true, imageUrl: true, caption: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ])

  if (!moveInReport || !moveOutReport) {
    redirect(
      tenancyId
        ? `/dashboard/tenant/conditions?tenancyId=${encodeURIComponent(tenancyId)}`
        : '/dashboard/tenant/conditions',
    )
  }

  const comparison = groupPhotosForComparison(moveInReport.photos, moveOutReport.photos)
  const backHref = `/dashboard/tenant/conditions?tenancyId=${encodeURIComponent(tenancy.id)}`
  const propertyLabel = `${tenancy.room.property.address}, ${tenancy.room.property.city}`

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link href={backHref} className="hover:text-[#C49A3C] transition-colors">
          Condition Reports
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Compare</span>
      </div>

      <ConditionComparisonView
        moveInReport={{
          createdAt: moveInReport.createdAt.toISOString(),
          createdByName: moveInReport.createdBy.name ?? 'Unknown',
          status: moveInReport.status,
          photoCount: moveInReport.photos.length,
        }}
        moveOutReport={{
          createdAt: moveOutReport.createdAt.toISOString(),
          createdByName: moveOutReport.createdBy.name ?? 'Unknown',
          status: moveOutReport.status,
          photoCount: moveOutReport.photos.length,
        }}
        comparison={comparison}
        backHref={backHref}
        propertyLabel={propertyLabel}
        tenantName={session.user.name ?? 'Tenant'}
      />
    </div>
  )
}
