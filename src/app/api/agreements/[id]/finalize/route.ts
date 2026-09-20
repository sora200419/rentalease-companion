// src/app/api/agreements/[id]/finalize/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildAgreementEvent,
  isFinalizeBlocked,
} from '@/lib/agreements/history';
import { createNotification } from '@/lib/notifications';
import { sendAgreementReadyEmail } from '@/lib/email';

const confirmedTermsSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
      .refine((s) => !isNaN(new Date(s).getTime()), 'startDate is not a valid calendar date'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
      .refine((s) => !isNaN(new Date(s).getTime()), 'endDate is not a valid calendar date'),
    monthlyRent: z.coerce
      .number()
      .positive('Monthly rent must be greater than 0'),
    depositAmount: z.coerce
      .number()
      .min(0, 'Deposit amount must be 0 or more'),
  })
  // String compare is safe — regex above guarantees YYYY-MM-DD, where lexical ordering equals chronological ordering.
  .refine((d) => d.endDate > d.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reviewedRedFlags = body?.reviewedRedFlags === true;

  const confirmedTermsResult = confirmedTermsSchema.safeParse(body?.confirmedTerms);
  if (!confirmedTermsResult.success) {
    return NextResponse.json(
      { error: confirmedTermsResult.error.issues[0]?.message ?? 'Invalid confirmedTerms' },
      { status: 400 },
    );
  }
  const { startDate, endDate, monthlyRent, depositAmount } = confirmedTermsResult.data;

  // Verify the agreement exists and the landlord owns it. We include the
  // tenant's email here so we don't have to re-query after the transaction
  // commits (previously a second findUnique fetched email separately).
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      changeRequests: {
        where: { status: 'PENDING' },
        select: { id: true },
      },
      tenancy: {
        select: {
          id: true,
          status: true,
          tenant: { select: { id: true, name: true, email: true, icNumber: true } },
          agreementPreferences: { select: { isComplete: true } },
          room: {
            include: {
              property: {
                select: { landlordId: true, address: true },
              },
            },
          },
        },
      },
    },
  });

  if (!agreement) {
    return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  }

  if (agreement.tenancy.room.property.landlordId !== session.user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  if (!['DRAFT', 'NEGOTIATING'].includes(agreement.status)) {
    return NextResponse.json(
      { error: 'Agreement cannot be finalized from its current status' },
      { status: 409 },
    );
  }

  if (!['PENDING', 'ACTIVE'].includes(agreement.tenancy.status)) {
    return NextResponse.json(
      { error: 'Agreement cannot be finalized because the tenancy has ended' },
      { status: 409 },
    );
  }

  const checklist = isFinalizeBlocked({
    hasRawContent: agreement.rawContent.trim().length > 0,
    isWizardComplete: agreement.tenancy.agreementPreferences?.isComplete === true,
    hasReviewedRedFlags: reviewedRedFlags,
    unresolvedStructuredRequests: agreement.changeRequests.length,
    hasRequiredIdentityData: Boolean(agreement.tenancy.tenant.icNumber?.trim()),
    isFinalizableStatus: true,
  });

  if (checklist.blocked) {
    return NextResponse.json(
      {
        error: 'Agreement is not ready to finalize yet.',
        checklist,
      },
      { status: 409 },
    );
  }

  // Atomically finalize. The conditional updateMany + count check guards against
  // a concurrent PATCH racing past the earlier status guard — two requests can
  // both pass the read-time check, but only one can satisfy the WHERE clause
  // here. Without this, two concurrent finalizes could overwrite tenancy terms
  // twice and emit two FINALIZED events. The interactive transaction also wraps
  // the dependent writes so a partial commit is impossible.
  let finalized = false;
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.agreement.updateMany({
      where: { id, status: { in: ['DRAFT', 'NEGOTIATING'] } },
      data: { status: 'FINALIZED' },
    });
    if (count === 0) {
      // Lost the race — another request already finalized this. Bail out
      // gracefully (the outer code below will treat this as "already done").
      return;
    }
    finalized = true;

    await tx.tenancy.update({
      where: { id: agreement.tenancy.id },
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyRent,
        depositAmount,
      },
    });

    // Resolve any open structured change requests — the checklist guard above
    // requires the count to be zero, but mark them explicitly RESOLVED so the
    // downstream agreement-history view doesn't show stale PENDING rows.
    await tx.agreementChangeRequest.updateMany({
      where: { agreementId: id, status: 'PENDING' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });

    await tx.agreementEvent.create({
      data: buildAgreementEvent({
        agreementId: id,
        type: 'FINALIZED',
        actorRole: 'LANDLORD',
        actorUserId: session.user.id,
        summary: 'Landlord finalized the agreement for tenant review.',
        metadata: {
          confirmedTerms: { startDate, endDate, monthlyRent, depositAmount },
          previousStatus: agreement.status,
        },
      }),
    });
  });

  if (!finalized) {
    return NextResponse.json(
      { error: 'Agreement was finalized by another request — refresh to see the latest state.' },
      { status: 409 },
    );
  }

  // Notify tenant to review and sign. createNotification swallows its own
  // errors (see lib/notifications.ts) so we don't need to wrap it.
  await createNotification(
    agreement.tenancy.tenant.id,
    'AGREEMENT_READY',
    'Your agreement is ready to review',
    `Your tenancy agreement for ${agreement.tenancy.room.property.address} has been finalized and is ready for your review and signature.`,
    `/dashboard/tenant/tenancy`,
  );

  // Send email (non-blocking) using the email we already loaded in the initial
  // query — no second user lookup needed.
  sendAgreementReadyEmail(
    agreement.tenancy.tenant.email,
    agreement.tenancy.tenant.name ?? 'Tenant',
    agreement.tenancy.room.property.address,
    id,
  ).catch((err) => console.error('[finalize] agreement-ready email failed:', err));

  return NextResponse.json({ ok: true, checklist });
}
