'use client';

import { WizardStepLayout, FieldGroup, RadioOption, CheckboxGroup } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

export function Step6Deposit({ data, onChange }: Props) {
  return (
    <WizardStepLayout
      step={6}
      title="Deposit Handling"
      description="Specify the deposit refund timeline, permitted deductions, and dispute resolution."
    >
      <FieldGroup
        label="Deposit Refund Timeline"
        help="How many days after a signed move-out condition report must the refund be made?"
      >
        <div className="flex gap-3 flex-wrap">
          {[7, 14, 30, 60].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange({ depositRefundDays: days })}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                data.depositRefundDays === days
                  ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                  : 'border-white/10 text-white/70 hover:border-white/10'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label="Permitted Deduction Categories"
        help="Which categories of costs may be deducted from the deposit?"
      >
        <CheckboxGroup
          options={[
            { value: 'DAMAGE', label: 'Damage beyond ordinary wear and tear' },
            { value: 'UNPAID_RENT', label: 'Unpaid rent' },
            { value: 'UNPAID_UTILITIES', label: 'Unpaid utility bills' },
            { value: 'CLEANING', label: 'Professional cleaning costs' },
          ]}
          selected={data.deductionCategories}
          onChange={(v) => onChange({ deductionCategories: v })}
        />
      </FieldGroup>

      <FieldGroup
        label="Deposit Dispute Resolution"
        help="If the tenant disputes a deduction, how should it be resolved?"
      >
        <div className="space-y-2">
          <RadioOption
            value="PLATFORM_MESSAGING"
            current={data.disputeResolution}
            onChange={(v) => onChange({ disputeResolution: v })}
            label="Good-faith discussion via platform messaging (7-day period)"
            description="Both parties discuss through the platform before escalating."
          />
          <RadioOption
            value="MEDIATION"
            current={data.disputeResolution}
            onChange={(v) => onChange({ disputeResolution: v })}
            label="Third-party mediation"
            description="A neutral mediator is engaged before any legal action."
          />
          <RadioOption
            value="COURT"
            current={data.disputeResolution}
            onChange={(v) => onChange({ disputeResolution: v })}
            label="Small Claims Tribunal or Malaysian Courts"
            description="Disputes go directly to legal channels."
          />
        </div>
      </FieldGroup>

      <FieldGroup
        label="Utility Deposit"
        help="Is a separate utility deposit collected in addition to the security deposit?"
      >
        <div className="space-y-2">
          <RadioOption value="NONE" current={data.utilityDepositHandling} onChange={(v) => onChange({ utilityDepositHandling: v })} label="No separate utility deposit" />
          <RadioOption value="COMBINED" current={data.utilityDepositHandling} onChange={(v) => onChange({ utilityDepositHandling: v })} label="Combined with security deposit" />
          <RadioOption value="SEPARATE" current={data.utilityDepositHandling} onChange={(v) => onChange({ utilityDepositHandling: v })} label="Collected separately" />
        </div>
      </FieldGroup>
    </WizardStepLayout>
  );
}
