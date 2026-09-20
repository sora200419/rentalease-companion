import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/RedesignPrimitives';
import { AdminNav } from '@/components/ui/AdminTabBar';

const ACTION_LABELS: Record<string, string> = {
  USER_DELETED: 'User Deleted',
  PROPERTY_DELETED: 'Property Deleted',
  ROOM_DELETED: 'Room Deleted',
  TENANT_DOCUMENT_DELETED: 'Document Deleted',
  CONDITION_PHOTO_DELETED: 'Condition Photo Deleted',
  CO_TENANT_DELETED: 'Co-tenant Deleted',
  PROPERTY_PHOTO_DELETED: 'Property Photo Deleted',
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard/admin');

  const params = await searchParams;
  const entityFilter = params.entity ?? 'all';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 20;

  const where = entityFilter !== 'all' ? { entityName: entityFilter } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const entities = ['User', 'Property', 'Room', 'TenantDocument', 'ConditionPhoto', 'CoTenant', 'PropertyPhoto'];

  return (
    <div className="max-w-5xl">
      <AdminNav active="audit-log" />
      <PageHeader
        eyebrow="Admin"
        title="Audit Log"
        description="Full record of all deletion events in the system."
      />

      <form method="GET" className="mb-6 flex gap-3">
        <select
          name="entity"
          defaultValue={entityFilter}
          className="bg-white/5 border border-[rgba(196,154,60,0.2)] text-white rounded-lg px-3 py-2 text-sm focus:border-[rgba(196,154,60,0.5)] focus:outline-none"
        >
          <option value="all">All entities</option>
          {entities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Filter
        </button>
      </form>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-12 text-center">
          <p className="text-base font-semibold text-white/70">No audit records found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="rounded-full bg-[rgba(248,113,113,0.12)] px-2 py-0.5 text-xs font-semibold text-[#f87171]">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {log.entityName} — <span className="font-mono text-xs text-white/50">{log.entityId}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    By {log.actor.name} ({log.actor.email})
                    {log.reason && <> · Reason: {log.reason}</>}
                    {log.ipAddress && <> · IP: {log.ipAddress}</>}
                  </p>
                </div>
                <p className="text-xs text-white/40">
                  {new Date(log.createdAt).toLocaleString('en-MY')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`?entity=${entityFilter}&page=${page - 1}`}
              className="rounded-lg border border-[rgba(196,154,60,0.2)] px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
            >
              Previous
            </a>
          )}
          <span className="rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-3 py-1.5 text-sm text-white">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`?entity=${entityFilter}&page=${page + 1}`}
              className="rounded-lg border border-[rgba(196,154,60,0.2)] px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
