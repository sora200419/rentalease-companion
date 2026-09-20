import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDeletedTenancyRedirectUrl } from '@/lib/landlordTenancyRedirect';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import GenerateAgreementButton from '@/components/ui/GenerateAgreementButton';
import EditTenancyTerms from './EditTenancyTerms';
import { EndOfTenancyBanner } from '@/components/ui/EndOfTenancyBanner';
import DepositVerificationCard from '@/components/ui/DepositVerificationCard';
import CoTenantManager from '@/components/ui/CoTenantManager';
import LandlordAgreementSignatureProofReview from '@/components/ui/LandlordAgreementSignatureProofReview';
import CorporateOccupantRosterManager from '@/components/ui/CorporateOccupantRosterManager';
import PropertyCover from '@/components/ui/PropertyCover';
import { PageHeader } from '@/components/ui/RedesignPrimitives';
import { getPropertyCover, TENANCY_STEPS, getTenancyStep } from '@/lib/uiRedesign';
import { getDepositSettlementEntry } from '@/lib/depositSettlementWorkflow';

const PILL_BASE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

const STATUS_PILL: Record<string, string> = {
  INVITED:    `${PILL_BASE} bg-[rgba(251,191,36,0.08)] text-[#E8B84B] ring-1 ring-[rgba(251,191,36,0.25)] ring-inset`,
  PENDING:    `${PILL_BASE} bg-[rgba(196,154,60,0.06)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.2)] ring-inset`,
  ACTIVE:     `${PILL_BASE} bg-[rgba(74,222,128,0.08)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset`,
  EXPIRED:    `${PILL_BASE} bg-white/5 text-white/50 ring-1 ring-white/10 ring-inset`,
  TERMINATED: `${PILL_BASE} bg-[rgba(248,113,113,0.08)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.25)] ring-inset`,
};

const AGREEMENT_PILL: Record<string, string> = {
  DRAFT:           `${PILL_BASE} bg-white/5 text-white/50 ring-1 ring-white/10 ring-inset`,
  FINALIZED:       `${PILL_BASE} bg-[rgba(74,222,128,0.08)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset`,
  PENDING_SIGNATURE_PROOF: `${PILL_BASE} bg-[rgba(196,154,60,0.06)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.2)] ring-inset`,
  SIGNED:          `${PILL_BASE} bg-[rgba(74,222,128,0.08)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset`,
  NEGOTIATING:     `${PILL_BASE} bg-purple-50 text-purple-700 ring-1 ring-purple-200 ring-inset`,
};

const PAYMENT_PILL = {
  PAID:         `${PILL_BASE} bg-[rgba(74,222,128,0.08)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset`,
  UNDER_REVIEW: `${PILL_BASE} bg-[rgba(196,154,60,0.06)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.2)] ring-inset`,
  PENDING:      `${PILL_BASE} bg-white/5 text-white/50 ring-1 ring-white/10 ring-inset`,
  OVERDUE:      `${PILL_BASE} bg-[rgba(248,113,113,0.08)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.25)] ring-inset`,
};


const STATUS_HEADLINE: Record<string, { headline: string; description: string }> = {
  INVITED:    { headline: 'Invitation sent', description: 'Waiting for tenant to accept the invitation.' },
  PENDING:    { headline: 'Agreement in progress', description: 'Review and finalize the tenancy agreement.' },
  ACTIVE:     { headline: 'Tenancy active', description: 'Tenancy is running. Monitor payments and condition reports.' },
  EXPIRED:    { headline: 'Tenancy ended', description: 'This tenancy has expired.' },
  TERMINATED: { headline: 'Tenancy terminated', description: 'This tenancy was terminated early.' },
};

export default async function TenancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'LANDLORD') redirect('/login');

  const { id } = await params;

  const tenancy = await prisma.tenancy.findFirst({
    where: { id, room: { property: { landlordId: session.user.id } } },
    include: {
      room: {
        include: {
          property: {
            include: {
              photos: {
                select: { imageUrl: true, caption: true, order: true, createdAt: true },
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                take: 1,
              },
            },
          },
        },
      },
      tenant: { select: { name: true, email: true, phone: true } },
      authorizedSignatoryUser: {
        select: { id: true, name: true, email: true },
      },
      agreement: {
        select: {
          id: true, status: true, plainLanguageSummary: true,
          redFlags: true, negotiationNotes: true, negotiationRound: true,
          createdAt: true, updatedAt: true,
          signatureProofs: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              fileUrl: true,
              originalName: true,
              mimeType: true,
              fileSize: true,
              status: true,
              rejectionReason: true,
              createdAt: true,
              reviewedAt: true,
            },
          },
        },
      },
      rentPayments: { orderBy: { dueDate: 'asc' } },
      conditionReports: { select: { id: true, type: true, acknowledgedAt: true } },
      agreementPreferences: { select: { isComplete: true, completedSteps: true } },
      depositRefund: { select: { id: true, status: true, refundAmount: true } },
      depositProofs: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, imageUrl: true, createdAt: true },
      },
      corporateOccupants: {
        orderBy: { createdAt: 'asc' },
        include: {
          linkedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      coTenants: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!tenancy) redirect(await getDeletedTenancyRedirectUrl(id, session.user.id));

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatRM = (amount: unknown) =>
    `RM ${Number(amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  let redFlagCount = 0;
  if (tenancy.agreement?.redFlags) {
    try {
      const flags = JSON.parse(tenancy.agreement.redFlags);
      redFlagCount = Array.isArray(flags) ? flags.length : 0;
    } catch { redFlagCount = 0; }
  }
  const latestSignatureProof = tenancy.agreement?.signatureProofs[0] ?? null;
  const isCorporate = tenancy.leasePartyType === 'CORPORATE';
  const canManageCorporateRoster = true;

  const totalReports = tenancy.conditionReports.length;
  const pendingAckReports = tenancy.conditionReports.filter((r) => !r.acknowledgedAt).length;
  const now = new Date();

  const daysUntilEnd = Math.ceil(
    (new Date(tenancy.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isEndingSoon = tenancy.status === 'ACTIVE' && daysUntilEnd <= 30 && daysUntilEnd > 0;

  const hasMoveOutReport = tenancy.conditionReports.some((r) => r.type === 'MOVE_OUT');
  const acknowledgedMoveOut = tenancy.conditionReports.find(
    (r) => r.type === 'MOVE_OUT' && r.acknowledgedAt,
  );
  const depositSettlementEntry = getDepositSettlementEntry({
    role: 'LANDLORD',
    acknowledgedMoveOut: Boolean(acknowledgedMoveOut),
    depositRefundStatus: tenancy.depositRefund?.status ?? null,
  });

  const isOverdue = (dueDate: Date, status: string) =>
    status === 'PENDING' && new Date(dueDate) < now;

  const cover = getPropertyCover(tenancy.room.property.photos ?? []);
  const activeStep = getTenancyStep(tenancy.status, tenancy.agreement?.status, tenancy.depositStatus);
  const statusInfo = STATUS_HEADLINE[tenancy.status] ?? { headline: tenancy.status, description: '' };

  return (
    <div className="max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
        <Link href="/dashboard/landlord/tenancies" className="hover:text-[#C49A3C] transition-colors">
          Tenancies
        </Link>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-white/70 font-medium truncate">
          {tenancy.room.property.address} — {tenancy.room.label}
        </span>
      </div>

      <PageHeader
        eyebrow="Tenancy detail"
        title={tenancy.room.property.address}
        description={`Room ${tenancy.room.label} · ${tenancy.tenant.name}`}
      />

      {/* 5-step progress timeline */}
      <div className="mb-6 grid gap-2 sm:grid-cols-5">
        {TENANCY_STEPS.map((step, index) => (
          <div
            key={step}
            className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold ${
              index < activeStep
                ? 'border-[rgba(196,154,60,0.2)] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                : index === activeStep
                ? 'border-[rgba(196,154,60,0.5)] bg-[rgba(196,154,60,0.1)] text-[#C49A3C] ring-1 ring-[rgba(196,154,60,0.3)] ring-inset'
                : 'border-[rgba(196,154,60,0.15)] bg-white/[0.03] text-white/40'
            }`}
          >
            {step}
          </div>
        ))}
      </div>

      {/* Two-column guided layout */}
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        {/* Left: property cover + status */}
        <section className="overflow-hidden rounded-2xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740]">
          <PropertyCover
            address={tenancy.room.property.address}
            imageUrl={cover?.imageUrl}
            caption={cover?.caption}
            className="rounded-none border-0"
            heightClassName="h-56"
          />
          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Current status</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{statusInfo.headline}</h2>
              <span className={STATUS_PILL[tenancy.status] ?? `${PILL_BASE} bg-white/5 text-white/50`}>
                {tenancy.status.charAt(0) + tenancy.status.slice(1).toLowerCase()}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/50">{statusInfo.description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {tenancy.agreement && (
                <Link
                  href={`/dashboard/landlord/tenancies/${tenancy.id}/agreement`}
                  className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  View Agreement
                </Link>
              )}
              {!tenancy.agreement && tenancy.status !== 'INVITED' && (
                !tenancy.agreementPreferences?.isComplete ? (
                  <Link
                    href={`/dashboard/landlord/tenancies/${tenancy.id}/wizard`}
                    className="inline-flex items-center gap-2 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    Start Agreement Wizard
                  </Link>
                ) : (
                  <GenerateAgreementButton tenancyId={tenancy.id} label="Generate Agreement" variant="primary" />
                )
              )}
              {tenancy.status === 'ACTIVE' && !isEndingSoon && (
                <Link
                  href={`/dashboard/landlord/tenancies/${id}/terminate`}
                  className="rounded-lg border border-[rgba(251,191,36,0.25)] bg-[#1C2740] px-4 py-2 text-sm font-semibold text-[#E8B84B] hover:bg-[rgba(251,191,36,0.08)] transition-colors"
                >
                  Serve Notice to Quit
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Right: next actions aside */}
        <aside className="rounded-2xl border border-[rgba(196,154,60,0.1)] bg-[rgba(196,154,60,0.06)] p-5">
          <h2 className="text-sm font-semibold text-[#C49A3C]">Next actions</h2>
          <div className="mt-4 space-y-3">
            {tenancy.agreement && (
              <Link
                href={`/dashboard/landlord/tenancies/${tenancy.id}/agreement`}
                className="flex items-center gap-3 rounded-xl border border-[rgba(196,154,60,0.2)] bg-[#1C2740] px-4 py-3 text-sm font-medium text-[#C49A3C] hover:bg-[rgba(196,154,60,0.06)] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View Agreement
              </Link>
            )}
            <Link
              href="/dashboard/landlord/payments"
              className="flex items-center gap-3 rounded-xl border border-[rgba(196,154,60,0.2)] bg-[#1C2740] px-4 py-3 text-sm font-medium text-[#C49A3C] hover:bg-[rgba(196,154,60,0.06)] transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Payments
            </Link>
            <Link
              href="/dashboard/landlord/messages"
              className="flex items-center gap-3 rounded-xl border border-[rgba(196,154,60,0.2)] bg-[#1C2740] px-4 py-3 text-sm font-medium text-[#C49A3C] hover:bg-[rgba(196,154,60,0.06)] transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
            </Link>
            <Link
              href={`/dashboard/landlord/tenancies/${tenancy.id}/conditions`}
              className="flex items-center gap-3 rounded-xl border border-[rgba(196,154,60,0.2)] bg-[#1C2740] px-4 py-3 text-sm font-medium text-[#C49A3C] hover:bg-[rgba(196,154,60,0.06)] transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Condition Reports
            </Link>
          </div>
        </aside>
      </div>

      <div className="space-y-5">
        {/* End-of-tenancy banner */}
        {isEndingSoon && (
          <EndOfTenancyBanner
            tenancyId={id}
            daysLeft={daysUntilEnd}
            role="LANDLORD"
            hasMoveOutReport={hasMoveOutReport}
            acknowledgedMoveOut={!!acknowledgedMoveOut}
            depositRefundStatus={tenancy.depositRefund?.status ?? null}
          />
        )}

        {/* EXPIRED/TERMINATED — next steps */}
        {(tenancy.status === 'EXPIRED' || tenancy.status === 'TERMINATED') && (
          <div className="flex items-start gap-3 bg-white/[0.03] border border-[rgba(196,154,60,0.15)] rounded-lg px-4 py-3 text-sm text-white/70">
            <svg className="w-4 h-4 text-white/40 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold mb-1">
                {tenancy.status === 'TERMINATED' ? 'Tenancy Terminated' : 'Tenancy Expired'}
              </p>
              {!hasMoveOutReport && (
                <p className="text-white/50 text-xs">
                  Create a Move-Out Condition Report to document the property state, then proceed to Deposit Settlement.
                </p>
              )}
              {hasMoveOutReport && !acknowledgedMoveOut && (
                <p className="text-[#E8B84B] text-xs">Move-out report awaiting acknowledgement before deposit settlement can begin.</p>
              )}
              {depositSettlementEntry && (
                <Link
                  href={`/dashboard/landlord/tenancies/${id}/deposit-settlement`}
                  className="text-sm font-medium text-[#C49A3C] hover:underline mt-1 block"
                >
                  {depositSettlementEntry.label}
                </Link>
              )}
              {depositSettlementEntry?.description && (
                <p className="text-white/40 text-xs mt-1">
                  {depositSettlementEntry.description}
                </p>
              )}
            </div>
          </div>
        )}

        {/* INVITED — waiting for tenant */}
        {tenancy.status === 'INVITED' && (
          <div className="flex items-start gap-3 bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 text-sm text-[#C49A3C]">
            <svg className="w-4 h-4 text-[#C49A3C] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Waiting for tenant to accept</p>
              <p className="text-[#C49A3C] text-xs mt-0.5">
                An invitation has been sent to {tenancy.tenant.name}. You can generate an agreement once they accept.
              </p>
            </div>
          </div>
        )}

        {/* Tenant info card */}
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Tenant</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[rgba(196,154,60,0.1)] flex items-center justify-center text-sm font-bold text-[#C49A3C] shrink-0">
              {tenancy.tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white">{tenancy.tenant.name}</p>
              <p className="text-sm text-white/40">{tenancy.tenant.email}</p>
              {tenancy.tenant.phone && (
                <p className="text-sm text-white/40">{tenancy.tenant.phone}</p>
              )}
            </div>
          </div>
        </div>

        {isCorporate ? (
          <>
            <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                Corporate Lease Party
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/40 text-xs">Company</p>
                  <p className="font-medium text-white mt-0.5">
                    {tenancy.companyName ?? 'Corporate tenant'}
                  </p>
                  {tenancy.companyRegistrationNo && (
                    <p className="text-xs text-white/50 mt-0.5">
                      Registration No. {tenancy.companyRegistrationNo}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-white/40 text-xs">Authorized Signatory</p>
                  <p className="font-medium text-white mt-0.5">
                    {tenancy.authorizedSignatoryName ?? tenancy.tenant.name}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {tenancy.authorizedSignatoryRole ??
                      'Role not specified'}
                    {tenancy.authorizedSignatoryIC
                      ? ` · ${tenancy.authorizedSignatoryIC}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
            <CorporateOccupantRosterManager
              tenancyId={id}
              initialOccupants={tenancy.corporateOccupants}
              canManage={canManageCorporateRoster}
            />
          </>
        ) : (
          <CoTenantManager
            tenancyId={id}
            initialCoTenants={tenancy.coTenants}
            readonly={
              tenancy.status === 'EXPIRED' || tenancy.status === 'TERMINATED'
            }
          />
        )}

        {/* Tenancy terms card */}
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Tenancy Terms</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs">Room</p>
              <p className="font-medium text-white mt-0.5">{tenancy.room.label}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Property Type</p>
              <p className="font-medium text-white mt-0.5">{tenancy.room.property.type}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Start Date</p>
              <p className="font-medium text-white mt-0.5">{formatDate(tenancy.startDate)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">End Date</p>
              <p className="font-medium text-white mt-0.5">{formatDate(tenancy.endDate)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Monthly Rent</p>
              <p className="font-medium text-white mt-0.5">{formatRM(tenancy.monthlyRent)}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs">Security Deposit</p>
              <p className="font-medium text-white mt-0.5">{formatRM(tenancy.depositAmount)}</p>
            </div>
          </div>
          {(tenancy.status === 'INVITED' || tenancy.status === 'PENDING') && !tenancy.agreement && (
            <EditTenancyTerms
              tenancyId={tenancy.id}
              currentStartDate={tenancy.startDate.toISOString()}
              currentEndDate={tenancy.endDate.toISOString()}
              currentMonthlyRent={Number(tenancy.monthlyRent)}
              currentDepositAmount={Number(tenancy.depositAmount)}
              tenancyStatus={tenancy.status}
              leasePartyType={tenancy.leasePartyType}
              currentInvitationEmail={
                tenancy.leasePartyType === 'CORPORATE'
                  ? tenancy.authorizedSignatoryUser?.email ?? tenancy.tenant.email
                  : tenancy.tenant.email
              }
            />
          )}
        </div>

        {/* Deposit verification */}
        {(tenancy.status === 'PENDING' || tenancy.status === 'ACTIVE') && (
          <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Security Deposit</h2>
            <DepositVerificationCard
              tenancyId={tenancy.id}
              depositAmount={formatRM(tenancy.depositAmount)}
              depositStatus={tenancy.depositStatus}
              proofs={tenancy.depositProofs}
              rejectionReason={tenancy.depositRejectionReason}
            />
          </div>
        )}

        {/* Property condition */}
        <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Property Condition</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white text-sm">
                {totalReports} {totalReports === 1 ? 'report' : 'reports'} created
              </p>
              {pendingAckReports > 0 && (
                <p className="text-[#E8B84B] text-xs mt-0.5">{pendingAckReports} pending acknowledgement</p>
              )}
              {totalReports === 0 && (
                <p className="text-white/40 text-xs mt-0.5">Document property condition with photos grouped by room</p>
              )}
            </div>
            <Link
              href={`/dashboard/landlord/tenancies/${tenancy.id}/conditions`}
              className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              {totalReports === 0 ? 'Start Report' : 'View Reports'}
            </Link>
          </div>
        </div>

        {tenancy.agreement?.status === 'PENDING_SIGNATURE_PROOF' && (
          <LandlordAgreementSignatureProofReview
            agreementId={tenancy.agreement.id}
            proof={latestSignatureProof}
            tenantName={tenancy.tenant.name}
          />
        )}

        {/* Agreement card */}
        {tenancy.status !== 'INVITED' && (
          <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Tenancy Agreement</h2>

            {tenancy.agreement ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={AGREEMENT_PILL[tenancy.agreement.status] ?? `${PILL_BASE} bg-white/5 text-white/50`}>
                      {tenancy.agreement.status.replace(/_/g, ' ')}
                    </span>
                    {redFlagCount > 0 && (
                      <span className={`${PILL_BASE} bg-[rgba(248,113,113,0.08)] text-[#f87171] ring-1 ring-[rgba(248,113,113,0.25)] ring-inset`}>
                        {redFlagCount} red {redFlagCount === 1 ? 'flag' : 'flags'}
                      </span>
                    )}
                    {(tenancy.agreement.negotiationRound ?? 0) > 0 && (
                      <span className="text-xs text-white/40">
                        Round {tenancy.agreement.negotiationRound}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">Updated {formatDate(tenancy.agreement.updatedAt)}</p>
                </div>

                {tenancy.agreement.status === 'NEGOTIATING' && (
                  <div className="flex items-start gap-3 bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 mb-4 text-sm text-[#C49A3C]">
                    <svg className="w-4 h-4 text-[#C49A3C] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <div>
                      <p className="font-semibold mb-1">Tenant has requested changes</p>
                      {tenancy.agreement.negotiationNotes && (
                        <div className="bg-[#1C2740] rounded-lg border border-[rgba(196,154,60,0.2)] px-3 py-2 mb-2">
                          <p className="text-xs text-white/40 mb-1">Tenant&apos;s feedback:</p>
                          <p className="text-sm text-white/70">{tenancy.agreement.negotiationNotes}</p>
                        </div>
                      )}
                      <p className="text-[#C49A3C] text-xs">
                        Use Regenerate to produce a revised agreement, or view the agreement to edit specific clauses manually.
                      </p>
                    </div>
                  </div>
                )}

                {tenancy.agreement.status === 'SIGNED' && (
                  <div className="flex items-start gap-3 bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-lg px-4 py-3 mb-4 text-sm text-[#4ade80]">
                    <svg className="w-4 h-4 text-[#4ade80] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="font-semibold">Agreement fully approved — Tenancy is active</p>
                      <p className="text-[#4ade80] text-xs mt-0.5">The digital signature and signed hard-copy proof are both complete. The rent payment schedule has been generated.</p>
                    </div>
                  </div>
                )}

                {tenancy.agreement.status === 'PENDING_SIGNATURE_PROOF' && (
                  <div className="flex items-start gap-3 bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 mb-4 text-sm text-[#C49A3C]">
                    <svg className="w-4 h-4 text-[#C49A3C] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold">Waiting for signed hard-copy approval</p>
                      <p className="text-[#C49A3C] text-xs mt-0.5">
                        The tenant has completed digital signing. Review the uploaded signed copy below before the tenancy can become active.
                      </p>
                    </div>
                  </div>
                )}

                {tenancy.agreement.status === 'FINALIZED' && (
                  <div className="flex items-start gap-3 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-lg px-4 py-3 mb-4 text-sm text-[#E8B84B]">
                    <svg className="w-4 h-4 text-[#E8B84B] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-semibold">Awaiting tenant review</p>
                      <p className="text-[#E8B84B] text-xs mt-0.5">The agreement has been sent to the tenant for review.</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/dashboard/landlord/tenancies/${tenancy.id}/agreement`}
                    className="bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    View Agreement
                  </Link>
                  {!['SIGNED', 'PENDING_SIGNATURE_PROOF'].includes(tenancy.agreement.status) && (
                    <>
                      <GenerateAgreementButton tenancyId={tenancy.id} label="Regenerate" variant="secondary" />
                      <Link
                        href={`/dashboard/landlord/tenancies/${tenancy.id}/wizard`}
                        className="border border-white/10 bg-[#1C2740] hover:bg-white/5 text-white/70 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                      >
                        Edit Wizard Answers
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-white/70 font-semibold">No agreement generated yet</p>
                <p className="text-sm text-white/40 mt-1 mb-5 max-w-sm mx-auto">
                  Use the guided wizard to capture your policy decisions, then let the AI generate a tailored agreement.
                </p>
                {!tenancy.agreementPreferences?.isComplete ? (
                  <Link
                    href={`/dashboard/landlord/tenancies/${tenancy.id}/wizard`}
                    className="inline-flex items-center gap-2 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740] text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                  >
                    Start Agreement Wizard
                  </Link>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-lg px-4 py-3 mb-3 text-sm text-[#4ade80] text-left">
                      <svg className="w-4 h-4 text-[#4ade80] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Wizard complete — ready to generate
                    </div>
                    <div className="flex gap-3 justify-center">
                      <GenerateAgreementButton tenancyId={tenancy.id} label="Generate Agreement" variant="primary" />
                      <Link
                        href={`/dashboard/landlord/tenancies/${tenancy.id}/wizard`}
                        className="border border-white/10 bg-[#1C2740] hover:bg-white/5 text-white/70 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                      >
                        Edit Wizard Answers
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rent payment schedule */}
        {tenancy.rentPayments.length > 0 && (
          <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Rent Payment Schedule</h2>
            <div className="divide-y divide-[rgba(255,255,255,0.06)]">
              {tenancy.rentPayments.map((payment) => {
                const overdue = isOverdue(payment.dueDate, payment.status);
                const pillClass = payment.status === 'PAID'
                  ? PAYMENT_PILL.PAID
                  : overdue
                  ? PAYMENT_PILL.OVERDUE
                  : payment.status === 'UNDER_REVIEW'
                  ? PAYMENT_PILL.UNDER_REVIEW
                  : PAYMENT_PILL.PENDING;

                return (
                  <div key={payment.id} className="flex items-center justify-between py-3">
                    <p className="text-sm text-white/70">{formatDate(payment.dueDate)}</p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-white">{formatRM(payment.amount)}</p>
                      <span className={pillClass}>
                        {overdue ? 'Overdue' : payment.status.charAt(0) + payment.status.slice(1).toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
