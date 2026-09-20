// src/lib/wizardFormatters.ts
// Converts wizard enum values to human-readable strings for Gemini prompts
// and PDF rendering. Both English and Malay versions are provided.

import type { AgreementPreferences } from '@prisma/client';

// ── English formatters ──────────────────────────────────────────────────────

export function formatPetsPolicy(policy: string): string {
  const map: Record<string, string> = {
    NONE: 'No pets are permitted on the premises',
    CATS_ONLY: 'Cats only are permitted (maximum as specified)',
    DOGS_ONLY: 'Dogs only are permitted (maximum as specified)',
    APPROVAL: 'Pets permitted with prior written landlord approval',
    UNRESTRICTED: 'Pets permitted without restriction',
  };
  return map[policy] ?? policy;
}

export function formatSmokingPolicy(policy: string): string {
  const map: Record<string, string> = {
    ANYWHERE: 'Smoking permitted anywhere on the premises',
    BALCONY_ONLY: 'Smoking permitted on balcony or outdoor areas only',
    NOT_INDOORS: 'Smoking not permitted indoors; permitted outdoors',
    NOT_ANYWHERE: 'No smoking anywhere on the premises or in common areas',
  };
  return map[policy] ?? policy;
}

export function formatOvernightGuests(policy: string, maxNights?: number | null): string {
  const map: Record<string, string> = {
    UNRESTRICTED: 'Overnight guests permitted without restriction',
    LIMITED: `Overnight guests permitted up to ${maxNights ?? 'specified'} nights per month`,
    NOTIFICATION: 'Overnight guests permitted with prior notification to landlord',
    NOT_ALLOWED: 'Overnight guests not permitted',
  };
  return map[policy] ?? policy;
}

export function formatQuietHours(policy: string, custom?: string | null): string {
  if (policy === 'STANDARD') return 'Standard quiet hours: 10:00 PM to 7:00 AM daily';
  if (policy === 'CUSTOM') return `Custom quiet hours: ${custom ?? 'as specified by landlord'}`;
  if (policy === 'NONE') return 'No specific quiet hours policy';
  return policy;
}

export function formatUtilityPayment(method: string): string {
  const map: Record<string, string> = {
    DIRECT_TO_PROVIDER: 'Tenant pays utility providers directly',
    REIMBURSE_LANDLORD: 'Tenant reimburses landlord monthly based on actual bills',
  };
  return map[method] ?? method;
}

export function formatUtilityDispute(method: string): string {
  const map: Record<string, string> = {
    OVER_TYPICAL: 'Tenant responsible for any usage above typical baseline',
    SPLIT_50_50: 'Disputed utility costs split equally between parties',
    LANDLORD_FINAL: 'Landlord has final decision on utility dispute allocation',
  };
  return map[method] ?? method;
}

export function formatServicing(method: string): string {
  const map: Record<string, string> = {
    LANDLORD_HANDLES_PAYS: 'Landlord arranges and pays for servicing',
    LANDLORD_HANDLES_TENANT_PAYS: 'Landlord arranges servicing; Tenant pays cost',
    TENANT: 'Tenant arranges and pays for servicing',
  };
  return map[method] ?? method;
}

export function formatLatePenalty(type: string, amount?: number | null): string {
  if (type === 'NONE') return 'No late payment penalty';
  if (type === 'FLAT') return `Flat penalty of RM ${amount?.toFixed(2) ?? '0.00'} per late payment`;
  if (type === 'PERCENTAGE') return `Penalty of ${amount ?? 0}% of monthly rent per late payment`;
  if (type === 'PER_DAY') return `Daily penalty of RM ${amount?.toFixed(2) ?? '0.00'} per day overdue`;
  return type;
}

export function formatPaymentMethods(methodsJson: string): string {
  try {
    const methods: string[] = JSON.parse(methodsJson);
    const labels: Record<string, string> = {
      BANK_TRANSFER: 'bank transfer',
      CASH: 'cash',
      EWALLET: 'e-wallet',
    };
    return methods.map((m) => labels[m] ?? m).join(', ');
  } catch {
    return methodsJson;
  }
}

export function formatRentIncrease(terms: string, percent?: number | null): string {
  const map: Record<string, string> = {
    NO_INCREASE: 'No rent increase permitted during the tenancy period',
    FIXED_PERCENT: `Annual rent increase of ${percent ?? 0}% fixed in advance`,
    MUTUAL_AGREEMENT: 'Rent increase only by mutual written agreement of both parties',
  };
  return map[terms] ?? terms;
}

export function formatResponsible(party: string): string {
  const map: Record<string, string> = {
    TENANT: 'Tenant',
    LANDLORD: 'Landlord',
    SPLIT: 'Split equally between parties',
    DEPENDS: 'Depends on the cause (negligence vs normal wear)',
  };
  return map[party] ?? party;
}

export function formatUrgentResponse(time: string): string {
  const map: Record<string, string> = {
    '24H': '24 hours',
    '48H': '48 hours',
    '72H': '72 hours',
    '7D': '7 days',
  };
  return map[time] ?? time;
}

export function formatEarlyTerminationPenalty(penalty: string, months?: number | null): string {
  const map: Record<string, string> = {
    NONE: 'No early termination penalty',
    FORFEIT_DEPOSIT: 'Full security deposit is forfeited',
    MONTHS_RENT: `Payment of ${months ?? 'specified'} month(s) rent as penalty`,
    PRORATED: 'Pro-rated penalty based on remaining tenancy term',
  };
  return map[penalty] ?? penalty;
}

export function formatReinstatement(level: string): string {
  const map: Record<string, string> = {
    BROOM_CLEAN: 'Broom-clean condition (swept, free of rubbish)',
    PROFESSIONAL_CLEANING: 'Professional cleaning required at tenant\'s expense',
    ORIGINAL_STATE: 'Restore to original condition as at move-in',
    AS_IS: 'As-is, except for major damage beyond ordinary wear and tear',
  };
  return map[level] ?? level;
}

export function formatSubletting(policy: string): string {
  const map: Record<string, string> = {
    NOT_ALLOWED: 'Subletting and transfer strictly prohibited',
    WITH_CONSENT: 'Subletting permitted only with prior written landlord consent',
    WITHOUT_CONSENT: 'Subletting permitted without requiring landlord consent',
  };
  return map[policy] ?? policy;
}

export function formatDeductionCategories(categoriesJson: string): string {
  try {
    const cats: string[] = JSON.parse(categoriesJson);
    const labels: Record<string, string> = {
      DAMAGE: 'damage beyond ordinary wear and tear',
      UNPAID_RENT: 'unpaid rent',
      UNPAID_UTILITIES: 'unpaid utility bills',
      CLEANING: 'professional cleaning costs',
      ALL: 'all of the above',
    };
    return cats.map((c) => labels[c] ?? c).join(', ');
  } catch {
    return categoriesJson;
  }
}

export function formatDisputeResolution(method: string): string {
  const map: Record<string, string> = {
    PLATFORM_MESSAGING: 'Good-faith discussion via platform messaging (minimum 7-day period)',
    MEDIATION: 'Third-party mediation before legal action',
    COURT: 'Small Claims Tribunal or Malaysian Courts',
  };
  return map[method] ?? method;
}

export function formatUtilityDeposit(handling: string): string {
  const map: Record<string, string> = {
    COMBINED: 'Utility deposit combined with security deposit',
    SEPARATE: 'Utility deposit collected separately from security deposit',
    NONE: 'No separate utility deposit required',
  };
  return map[handling] ?? handling;
}

// ── Build the full policy block for Gemini injection ──────────────────────────
export function buildWizardPolicyBlock(prefs: AgreementPreferences): string {
  const latePenaltyAmount = prefs.latePenaltyAmount ? Number(prefs.latePenaltyAmount) : null;
  const rentIncreasePercent = prefs.rentIncreasePercent ? Number(prefs.rentIncreasePercent) : null;
  const minorRepairThreshold = Number(prefs.minorRepairThreshold);
  const earlyTerminationMonths = prefs.earlyTerminationMonths ?? null;
  const petsDeposit = prefs.petsDeposit ? Number(prefs.petsDeposit) : null;

  return `
── LANDLORD POLICY DECISIONS (FROM WIZARD) ───────────────────────────────────
The following are explicit decisions made by the landlord. Draft each relevant
clause to reflect these positions precisely. Do not invent alternative positions
or default to different values.

Pets: ${formatPetsPolicy(prefs.petsPolicy)}${
    prefs.petsMaxCount ? ` (maximum ${prefs.petsMaxCount} pet${prefs.petsMaxCount > 1 ? 's' : ''})` : ''
  }${petsDeposit ? ` — pet deposit: RM ${petsDeposit.toFixed(2)}` : ''}
Smoking: ${formatSmokingPolicy(prefs.smokingPolicy)}
Overnight Guests: ${formatOvernightGuests(prefs.overnightGuests, prefs.overnightMaxNights)}
Quiet Hours: ${formatQuietHours(prefs.quietHoursPolicy, prefs.quietHoursCustom)}${
    prefs.additionalHouseRules
      ? `\nAdditional House Rules: "${prefs.additionalHouseRules}"`
      : ''
  }

Utility Payment Arrangement: ${formatUtilityPayment(prefs.utilityPaymentMethod)}
Utility Bill Disputes: ${formatUtilityDispute(prefs.utilityDisputeMethod)}${
    prefs.internetProvider
      ? `\nInternet Provider: ${prefs.internetProvider} (account managed by: ${prefs.internetAccountManager ?? 'landlord'})`
      : ''
  }
Air-Conditioning Servicing: ${formatServicing(prefs.acServicing)}
Pest Control: ${formatServicing(prefs.pestControl)}

Rent Due Day: ${prefs.rentDueDay}${['st', 'nd', 'rd'][prefs.rentDueDay - 1] ?? 'th'} of each calendar month
Grace Period: ${prefs.gracePeriodDays} day${prefs.gracePeriodDays !== 1 ? 's' : ''} before late penalty applies
Late Payment Penalty: ${formatLatePenalty(prefs.latePenaltyType, latePenaltyAmount)}
Acceptable Payment Methods: ${formatPaymentMethods(prefs.acceptablePaymentMethods)}
Annual Rent Increase: ${formatRentIncrease(prefs.rentIncreaseTerms, rentIncreasePercent)}

Maintenance Responsibility:
  - Minor repairs (under RM ${minorRepairThreshold.toFixed(2)}): ${formatResponsible(prefs.minorRepairResponsible)}
  - Plumbing repairs: ${formatResponsible(prefs.plumbingResponsible)}
  - Electrical repairs: ${formatResponsible(prefs.electricalResponsible)}
  - Appliance repairs (landlord-provided appliances): ${formatResponsible(prefs.applianceResponsible)}
  - Structural damage: ${formatResponsible(prefs.structuralResponsible)}
  - Urgent repair response commitment: within ${formatUrgentResponse(prefs.urgentResponseTime)}

Tenant notice to leave early: ${prefs.tenantNoticeMonths} month${prefs.tenantNoticeMonths !== 1 ? 's' : ''}
Landlord notice to require vacant possession: ${
    prefs.landlordNoticeMonths === 0
      ? 'Not permitted except upon breach'
      : `${prefs.landlordNoticeMonths} month${prefs.landlordNoticeMonths !== 1 ? 's' : ''}`
  }
Early termination penalty: ${formatEarlyTerminationPenalty(prefs.earlyTerminationPenalty, earlyTerminationMonths)}
Move-out reinstatement: ${formatReinstatement(prefs.reinstatementLevel)}
Subletting: ${formatSubletting(prefs.sublettingPolicy)}

Deposit refund timeline: ${prefs.depositRefundDays} days after acknowledged move-out condition report
Permitted deposit deductions: ${formatDeductionCategories(prefs.deductionCategories)}
Deposit dispute resolution: ${formatDisputeResolution(prefs.disputeResolution)}
Utility deposit: ${formatUtilityDeposit(prefs.utilityDepositHandling)}
`;
}
