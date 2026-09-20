// src/components/wizard/WizardTypes.ts
// Shared type for the wizard form state — all six steps combined.

export interface WizardFormData {
  tenancyId: string;

  // Step 1 — House Rules
  petsPolicy: string;
  petsMaxCount: number | null;
  petsDeposit: number | null;
  smokingPolicy: string;
  overnightGuests: string;
  overnightMaxNights: number | null;
  quietHoursPolicy: string;
  quietHoursCustom: string;
  additionalHouseRules: string;

  // Step 2 — Utilities
  utilityPaymentMethod: string;
  utilityDisputeMethod: string;
  internetProvider: string;
  internetAccountManager: string;
  acServicing: string;
  pestControl: string;

  // Step 3 — Financial
  rentDueDay: number;
  gracePeriodDays: number;
  latePenaltyType: string;
  latePenaltyAmount: number | null;
  acceptablePaymentMethods: string[];
  rentIncreaseTerms: string;
  rentIncreasePercent: number | null;

  // Step 4 — Maintenance
  minorRepairThreshold: number;
  minorRepairResponsible: string;
  plumbingResponsible: string;
  electricalResponsible: string;
  applianceResponsible: string;
  structuralResponsible: string;
  urgentResponseTime: string;

  // Step 5 — Ending
  tenantNoticeMonths: number;
  landlordNoticeMonths: number;
  earlyTerminationPenalty: string;
  earlyTerminationMonths: number | null;
  reinstatementLevel: string;
  sublettingPolicy: string;

  // Step 6 — Deposit
  depositRefundDays: number;
  deductionCategories: string[];
  disputeResolution: string;
  utilityDepositHandling: string;
}

export const DEFAULT_FORM: Omit<WizardFormData, 'tenancyId'> = {
  petsPolicy: 'NONE',
  petsMaxCount: null,
  petsDeposit: null,
  smokingPolicy: 'NOT_ANYWHERE',
  overnightGuests: 'NOTIFICATION',
  overnightMaxNights: null,
  quietHoursPolicy: 'STANDARD',
  quietHoursCustom: '',
  additionalHouseRules: '',

  utilityPaymentMethod: 'DIRECT_TO_PROVIDER',
  utilityDisputeMethod: 'OVER_TYPICAL',
  internetProvider: '',
  internetAccountManager: 'LANDLORD',
  acServicing: 'LANDLORD_HANDLES_PAYS',
  pestControl: 'LANDLORD_HANDLES_PAYS',

  rentDueDay: 1,
  gracePeriodDays: 7,
  latePenaltyType: 'FLAT',
  latePenaltyAmount: 50,
  acceptablePaymentMethods: ['BANK_TRANSFER'],
  rentIncreaseTerms: 'NO_INCREASE',
  rentIncreasePercent: null,

  minorRepairThreshold: 200,
  minorRepairResponsible: 'TENANT',
  plumbingResponsible: 'LANDLORD',
  electricalResponsible: 'LANDLORD',
  applianceResponsible: 'LANDLORD',
  structuralResponsible: 'LANDLORD',
  urgentResponseTime: '48H',

  tenantNoticeMonths: 2,
  landlordNoticeMonths: 2,
  earlyTerminationPenalty: 'FORFEIT_DEPOSIT',
  earlyTerminationMonths: null,
  reinstatementLevel: 'BROOM_CLEAN',
  sublettingPolicy: 'NOT_ALLOWED',

  depositRefundDays: 30,
  deductionCategories: ['DAMAGE', 'UNPAID_RENT', 'UNPAID_UTILITIES'],
  disputeResolution: 'PLATFORM_MESSAGING',
  utilityDepositHandling: 'NONE',
};
