// src/app/api/agreements/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildAgreementEvent,
  buildAgreementRevision,
} from '@/lib/agreements/history';
import { generateTenancyAgreement, translateAgreementOutputs } from '@/lib/gemini';
import { agreementGenerateLimit } from '@/lib/ratelimit';
import { z } from 'zod';

const bodySchema = z.object({
  tenancyId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { tenancyId } = bodySchema.parse(body);

    // Rate limit: 5 agreement generations per tenancy per hour (IMP-02)
    const { success, remaining } = await agreementGenerateLimit.limit(
      `${session.user.id}:${tenancyId}`,
    );
    if (!success) {
      return NextResponse.json(
        { error: `Too many requests. You can generate ${remaining} more time(s). Please wait before regenerating.` },
        { status: 429 },
      );
    }

    // Authorization chain: Tenancy → Room → Property → landlordId
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: tenancyId,
        room: { property: { landlordId: session.user.id } },
      },
      include: {
        room: {
          include: {
            property: true,
          },
        },
        tenant: {
          select: {
            name: true,
            email: true,
            phone: true,
            icNumber: true,
          },
        },
        corporateOccupants: {
          where: { status: { in: ['UNLINKED', 'LINKED'] } },
          select: { name: true, roleLabel: true },
          orderBy: { createdAt: 'asc' },
        },
        coTenants: {
          select: { name: true, icNumber: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenancy)
      return NextResponse.json(
        { error: 'Tenancy not found or access denied' },
        { status: 404 },
      );

    if (tenancy.status === 'INVITED')
      return NextResponse.json(
        { error: 'The tenant has not yet accepted the invitation. Please wait for them to accept before generating an agreement.' },
        { status: 409 },
      );

    if (!['PENDING', 'ACTIVE'].includes(tenancy.status))
      return NextResponse.json(
        { error: 'Agreement cannot be generated for a tenancy that has ended.' },
        { status: 409 },
      );

    const landlord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phone: true, icNumber: true },
    });

    if (!landlord)
      return NextResponse.json(
        { error: 'Landlord not found' },
        { status: 404 },
      );

    const existingAgreement = await prisma.agreement.findUnique({
      where: { tenancyId },
      select: { id: true, negotiationNotes: true, negotiationRound: true },
    });

    // BUG-15: Cap negotiation rounds to prevent unlimited regeneration
    const MAX_NEGOTIATION_ROUNDS = 5;
    if (existingAgreement && existingAgreement.negotiationRound >= MAX_NEGOTIATION_ROUNDS) {
      return NextResponse.json(
        { error: `Maximum negotiation rounds (${MAX_NEGOTIATION_ROUNDS}) reached. Please contact support if further changes are needed.` },
        { status: 409 },
      );
    }

    // Load wizard preferences — required for generation
    const preferences = await prisma.agreementPreferences.findUnique({
      where: { tenancyId },
    });

    if (!preferences || !preferences.isComplete) {
      return NextResponse.json(
        {
          error:
            'Please complete the Agreement Wizard before generating. The wizard captures the policy decisions needed to produce an accurate agreement.',
          requiresWizard: true,
        },
        { status: 400 },
      );
    }

    const generated = await generateTenancyAgreement({
      id: tenancy.id,
      startDate: tenancy.startDate,
      endDate: tenancy.endDate,
      monthlyRent: tenancy.monthlyRent,
      depositAmount: tenancy.depositAmount,
      leasePartyType: tenancy.leasePartyType,
      companyName: tenancy.companyName,
      companyRegistrationNo: tenancy.companyRegistrationNo,
      authorizedSignatoryName: tenancy.authorizedSignatoryName,
      authorizedSignatoryRole: tenancy.authorizedSignatoryRole,
      authorizedSignatoryIC: tenancy.authorizedSignatoryIC,
      property: {
        address: tenancy.room.property.address,
        city: tenancy.room.property.city,
        state: tenancy.room.property.state,
        postcode: tenancy.room.property.postcode,
        type: tenancy.room.property.type,
      },
      // Phase 13: pass all rich room fields so Gemini generates accurate clauses
      room: {
        label: tenancy.room.label,
        bathrooms: tenancy.room.bathrooms,
        roomType: tenancy.room.roomType,
        bathroomType: tenancy.room.bathroomType,
        furnishing: tenancy.room.furnishing,
        maxOccupants: tenancy.room.maxOccupants,
        wifiIncluded: tenancy.room.wifiIncluded,
        waterIncluded: tenancy.room.waterIncluded,
        electricIncluded: tenancy.room.electricIncluded,
        genderPreference: tenancy.room.genderPreference,
        sizeSqFt: tenancy.room.sizeSqFt,
        notes: tenancy.room.notes,
      },
      tenant: tenancy.tenant,
      landlord,
      negotiationContext: existingAgreement?.negotiationNotes ?? null,
      coTenants: tenancy.coTenants,
      corporateOccupants: tenancy.corporateOccupants,
    }, preferences);

    // Second call: translate summary and red flags into Malay.
    // Failures here are non-blocking — the English generation already succeeded.
    let plainLanguageSummaryMs: string | null = null;
    let redFlagsMs: string | null = null;
    try {
      const translated = await translateAgreementOutputs(
        generated.plainLanguageSummary,
        generated.redFlags,
      );
      plainLanguageSummaryMs = translated.plainLanguageSummaryMs;
      redFlagsMs = translated.redFlagsMs;
    } catch (translationError) {
      console.error('Bilingual translation failed (non-blocking):', translationError);
    }

    const nextRound = (existingAgreement?.negotiationRound ?? 0) + 1;

    const currentRevisionCount = existingAgreement
      ? await prisma.agreementRevision.count({
          where: { agreementId: existingAgreement.id },
        })
      : 0;

    const agreement = await prisma.$transaction(async (tx) => {
      const savedAgreement = await tx.agreement.upsert({
        where: { tenancyId },
        create: {
          tenancyId,
          rawContent: generated.rawContent,
          plainLanguageSummary: generated.plainLanguageSummary,
          plainLanguageSummaryMs,
          redFlags: generated.redFlags,
          redFlagsMs,
          status: 'DRAFT',
          negotiationRound: 1,
        },
        update: {
          rawContent: generated.rawContent,
          plainLanguageSummary: generated.plainLanguageSummary,
          plainLanguageSummaryMs,
          redFlags: generated.redFlags,
          redFlagsMs,
          status: 'DRAFT',
          negotiationRound: nextRound,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          negotiationRound: true,
          createdAt: true,
          rawContent: true,
          plainLanguageSummary: true,
          plainLanguageSummaryMs: true,
          redFlags: true,
          redFlagsMs: true,
        },
      });

      const versionNumber = currentRevisionCount + 1;

      await tx.agreementRevision.create({
        data: buildAgreementRevision({
          agreementId: savedAgreement.id,
          versionNumber,
          rawContent: savedAgreement.rawContent,
          plainLanguageSummary: savedAgreement.plainLanguageSummary,
          plainLanguageSummaryMs: savedAgreement.plainLanguageSummaryMs,
          redFlags: savedAgreement.redFlags ?? '[]',
          redFlagsMs: savedAgreement.redFlagsMs,
          createdByUserId: session.user.id,
        }),
      });

      await tx.agreementEvent.create({
        data: buildAgreementEvent({
          agreementId: savedAgreement.id,
          type: 'GENERATED',
          actorRole: 'LANDLORD',
          actorUserId: session.user.id,
          summary:
            versionNumber === 1
              ? 'Version 1 generated from the agreement wizard.'
              : `Version ${versionNumber} regenerated for landlord review.`,
        }),
      });

      return savedAgreement;
    });

    return NextResponse.json(
      {
        message: 'Agreement generated successfully',
        agreement: {
          id: agreement.id,
          status: agreement.status,
          negotiationRound: agreement.negotiationRound,
          createdAt: agreement.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );

    const message =
      error instanceof Error ? error.message : 'Failed to generate agreement';
    console.error('Agreement generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
