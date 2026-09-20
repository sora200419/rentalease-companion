// src/app/api/agreement-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const prefsSchema = z.object({
  tenancyId: z.string().min(1),
  // Step 1
  petsPolicy: z.enum(['NONE', 'CATS_ONLY', 'DOGS_ONLY', 'APPROVAL', 'UNRESTRICTED']),
  petsMaxCount: z.number().int().positive().optional().nullable(),
  petsDeposit: z.number().min(0).optional().nullable(),
  smokingPolicy: z.enum(['ANYWHERE', 'BALCONY_ONLY', 'NOT_INDOORS', 'NOT_ANYWHERE']),
  overnightGuests: z.enum(['UNRESTRICTED', 'LIMITED', 'NOTIFICATION', 'NOT_ALLOWED']),
  overnightMaxNights: z.number().int().positive().optional().nullable(),
  quietHoursPolicy: z.enum(['STANDARD', 'CUSTOM', 'NONE']),
  quietHoursCustom: z.string().optional().nullable(),
  additionalHouseRules: z.string().optional().nullable(),
  // Step 2
  utilityPaymentMethod: z.enum(['DIRECT_TO_PROVIDER', 'REIMBURSE_LANDLORD']),
  utilityDisputeMethod: z.enum(['OVER_TYPICAL', 'SPLIT_50_50', 'LANDLORD_FINAL']),
  internetProvider: z.string().optional().nullable(),
  internetAccountManager: z.enum(['LANDLORD', 'TENANT', 'SHARED']).optional().nullable(),
  acServicing: z.enum(['LANDLORD_HANDLES_PAYS', 'LANDLORD_HANDLES_TENANT_PAYS', 'TENANT']),
  pestControl: z.enum(['LANDLORD_HANDLES_PAYS', 'LANDLORD_HANDLES_TENANT_PAYS', 'TENANT']),
  // Step 3
  rentDueDay: z.number().int().min(1).max(28),
  gracePeriodDays: z.number().int().min(0),
  latePenaltyType: z.enum(['NONE', 'FLAT', 'PERCENTAGE', 'PER_DAY']),
  latePenaltyAmount: z.number().min(0).optional().nullable(),
  acceptablePaymentMethods: z.string(), // JSON array
  rentIncreaseTerms: z.enum(['NO_INCREASE', 'FIXED_PERCENT', 'MUTUAL_AGREEMENT']),
  rentIncreasePercent: z.number().min(0).max(100).optional().nullable(),
  // Step 4
  minorRepairThreshold: z.number().min(0),
  minorRepairResponsible: z.enum(['TENANT', 'LANDLORD', 'SPLIT', 'DEPENDS']),
  plumbingResponsible: z.enum(['TENANT', 'LANDLORD', 'SPLIT', 'DEPENDS']),
  electricalResponsible: z.enum(['TENANT', 'LANDLORD', 'SPLIT', 'DEPENDS']),
  applianceResponsible: z.enum(['TENANT', 'LANDLORD', 'SPLIT', 'DEPENDS']),
  structuralResponsible: z.enum(['TENANT', 'LANDLORD', 'SPLIT', 'DEPENDS']),
  urgentResponseTime: z.enum(['24H', '48H', '72H', '7D']),
  // Step 5
  tenantNoticeMonths: z.number().int().min(1),
  landlordNoticeMonths: z.number().int().min(0),
  earlyTerminationPenalty: z.enum(['NONE', 'FORFEIT_DEPOSIT', 'MONTHS_RENT', 'PRORATED']),
  earlyTerminationMonths: z.number().int().positive().optional().nullable(),
  reinstatementLevel: z.enum(['BROOM_CLEAN', 'PROFESSIONAL_CLEANING', 'ORIGINAL_STATE', 'AS_IS']),
  sublettingPolicy: z.enum(['NOT_ALLOWED', 'WITH_CONSENT', 'WITHOUT_CONSENT']),
  // Step 6
  depositRefundDays: z.number().int().positive(),
  deductionCategories: z.string(), // JSON array
  disputeResolution: z.enum(['PLATFORM_MESSAGING', 'MEDIATION', 'COURT']),
  utilityDepositHandling: z.enum(['COMBINED', 'SEPARATE', 'NONE']),
  // Progress
  completedSteps: z.number().int().min(0).max(6).default(0),
  isComplete: z.boolean().default(false),
});

// GET /api/agreement-preferences?tenancyId=xxx
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const tenancyId = request.nextUrl.searchParams.get('tenancyId');
  if (!tenancyId) return NextResponse.json({ error: 'tenancyId required' }, { status: 400 });

  // Verify landlord owns this tenancy
  const tenancy = await prisma.tenancy.findFirst({
    where: { id: tenancyId, room: { property: { landlordId: session.user.id } } },
    select: { id: true },
  });
  if (!tenancy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const prefs = await prisma.agreementPreferences.findUnique({
    where: { tenancyId },
  });

  if (!prefs) return NextResponse.json({ error: 'No preferences yet' }, { status: 404 });
  return NextResponse.json({ preferences: prefs });
}

// POST /api/agreement-preferences — upsert full preferences
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const data = prefsSchema.parse(body);

    // Authorization: verify landlord owns this tenancy
    const tenancy = await prisma.tenancy.findFirst({
      where: { id: data.tenancyId, room: { property: { landlordId: session.user.id } } },
      select: { id: true, status: true },
    });
    if (!tenancy) return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
    if (tenancy.status === 'EXPIRED' || tenancy.status === 'TERMINATED')
      return NextResponse.json(
        { error: 'Cannot modify preferences for a completed tenancy' },
        { status: 409 },
      );

    const prefs = await prisma.agreementPreferences.upsert({
      where: { tenancyId: data.tenancyId },
      create: {
        tenancyId: data.tenancyId,
        petsPolicy: data.petsPolicy,
        petsMaxCount: data.petsMaxCount ?? null,
        petsDeposit: data.petsDeposit ?? null,
        smokingPolicy: data.smokingPolicy,
        overnightGuests: data.overnightGuests,
        overnightMaxNights: data.overnightMaxNights ?? null,
        quietHoursPolicy: data.quietHoursPolicy,
        quietHoursCustom: data.quietHoursCustom ?? null,
        additionalHouseRules: data.additionalHouseRules ?? null,
        utilityPaymentMethod: data.utilityPaymentMethod,
        utilityDisputeMethod: data.utilityDisputeMethod,
        internetProvider: data.internetProvider ?? null,
        internetAccountManager: data.internetAccountManager ?? null,
        acServicing: data.acServicing,
        pestControl: data.pestControl,
        rentDueDay: data.rentDueDay,
        gracePeriodDays: data.gracePeriodDays,
        latePenaltyType: data.latePenaltyType,
        latePenaltyAmount: data.latePenaltyAmount ?? null,
        acceptablePaymentMethods: data.acceptablePaymentMethods,
        rentIncreaseTerms: data.rentIncreaseTerms,
        rentIncreasePercent: data.rentIncreasePercent ?? null,
        minorRepairThreshold: data.minorRepairThreshold,
        minorRepairResponsible: data.minorRepairResponsible,
        plumbingResponsible: data.plumbingResponsible,
        electricalResponsible: data.electricalResponsible,
        applianceResponsible: data.applianceResponsible,
        structuralResponsible: data.structuralResponsible,
        urgentResponseTime: data.urgentResponseTime,
        tenantNoticeMonths: data.tenantNoticeMonths,
        landlordNoticeMonths: data.landlordNoticeMonths,
        earlyTerminationPenalty: data.earlyTerminationPenalty,
        earlyTerminationMonths: data.earlyTerminationMonths ?? null,
        reinstatementLevel: data.reinstatementLevel,
        sublettingPolicy: data.sublettingPolicy,
        depositRefundDays: data.depositRefundDays,
        deductionCategories: data.deductionCategories,
        disputeResolution: data.disputeResolution,
        utilityDepositHandling: data.utilityDepositHandling,
        completedSteps: data.completedSteps,
        isComplete: data.isComplete,
      },
      update: {
        petsPolicy: data.petsPolicy,
        petsMaxCount: data.petsMaxCount ?? null,
        petsDeposit: data.petsDeposit ?? null,
        smokingPolicy: data.smokingPolicy,
        overnightGuests: data.overnightGuests,
        overnightMaxNights: data.overnightMaxNights ?? null,
        quietHoursPolicy: data.quietHoursPolicy,
        quietHoursCustom: data.quietHoursCustom ?? null,
        additionalHouseRules: data.additionalHouseRules ?? null,
        utilityPaymentMethod: data.utilityPaymentMethod,
        utilityDisputeMethod: data.utilityDisputeMethod,
        internetProvider: data.internetProvider ?? null,
        internetAccountManager: data.internetAccountManager ?? null,
        acServicing: data.acServicing,
        pestControl: data.pestControl,
        rentDueDay: data.rentDueDay,
        gracePeriodDays: data.gracePeriodDays,
        latePenaltyType: data.latePenaltyType,
        latePenaltyAmount: data.latePenaltyAmount ?? null,
        acceptablePaymentMethods: data.acceptablePaymentMethods,
        rentIncreaseTerms: data.rentIncreaseTerms,
        rentIncreasePercent: data.rentIncreasePercent ?? null,
        minorRepairThreshold: data.minorRepairThreshold,
        minorRepairResponsible: data.minorRepairResponsible,
        plumbingResponsible: data.plumbingResponsible,
        electricalResponsible: data.electricalResponsible,
        applianceResponsible: data.applianceResponsible,
        structuralResponsible: data.structuralResponsible,
        urgentResponseTime: data.urgentResponseTime,
        tenantNoticeMonths: data.tenantNoticeMonths,
        landlordNoticeMonths: data.landlordNoticeMonths,
        earlyTerminationPenalty: data.earlyTerminationPenalty,
        earlyTerminationMonths: data.earlyTerminationMonths ?? null,
        reinstatementLevel: data.reinstatementLevel,
        sublettingPolicy: data.sublettingPolicy,
        depositRefundDays: data.depositRefundDays,
        deductionCategories: data.deductionCategories,
        disputeResolution: data.disputeResolution,
        utilityDepositHandling: data.utilityDepositHandling,
        completedSteps: data.completedSteps,
        isComplete: data.isComplete,
      },
    });

    return NextResponse.json({ preferences: prefs }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error('Agreement preferences error:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
