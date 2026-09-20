'use client';

import { WizardStepLayout, FieldGroup, RadioOption, NumberInput, CheckboxGroup } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

export function Step3Financial({ data, onChange }: Props) {
  return (
    <WizardStepLayout
      step={3}
      title="Financial Terms"
      description="Define rent payment schedule, late fees, and increase terms."
    >
      <FieldGroup label="Rent Due Day" help="Which day of the month is rent due?">
        <div className="flex items-center gap-3">
          <NumberInput
            value={data.rentDueDay}
            onChange={(v) => onChange({ rentDueDay: v ?? 1 })}
            min={1}
            max={28}
            suffix="of each month"
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Grace Period" help="How many days after the due date before a late penalty applies?">
        <div className="flex gap-3 flex-wrap">
          {[0, 3, 7, 14].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange({ gracePeriodDays: days })}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                data.gracePeriodDays === days
                  ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                  : 'border-white/10 text-white/70 hover:border-white/10'
              }`}
            >
              {days === 0 ? 'No grace period' : `${days} days`}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Late Payment Penalty" help="What happens if rent is paid after the grace period?">
        <div className="space-y-2">
          <RadioOption value="NONE" current={data.latePenaltyType} onChange={(v) => onChange({ latePenaltyType: v })} label="No late penalty" />
          <RadioOption value="FLAT" current={data.latePenaltyType} onChange={(v) => onChange({ latePenaltyType: v })} label="Flat fee per late payment" />
          <RadioOption value="PERCENTAGE" current={data.latePenaltyType} onChange={(v) => onChange({ latePenaltyType: v })} label="Percentage of monthly rent" />
          <RadioOption value="PER_DAY" current={data.latePenaltyType} onChange={(v) => onChange({ latePenaltyType: v })} label="Daily accrual (per day overdue)" />
        </div>
        {data.latePenaltyType !== 'NONE' && (
          <div className="mt-3 ml-7">
            <NumberInput
              label={data.latePenaltyType === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount (RM)'}
              value={data.latePenaltyAmount}
              onChange={(v) => onChange({ latePenaltyAmount: v })}
              min={0}
              prefix={data.latePenaltyType !== 'PERCENTAGE' ? 'RM' : undefined}
              suffix={data.latePenaltyType === 'PERCENTAGE' ? '%' : undefined}
              placeholder="e.g. 50"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Acceptable Payment Methods">
        <CheckboxGroup
          options={[
            { value: 'BANK_TRANSFER', label: 'Bank transfer / online banking' },
            { value: 'CASH', label: 'Cash' },
            { value: 'EWALLET', label: 'E-wallet (Touch \'n Go, GrabPay, etc.)' },
          ]}
          selected={data.acceptablePaymentMethods}
          onChange={(v) => onChange({ acceptablePaymentMethods: v })}
        />
      </FieldGroup>

      <FieldGroup label="Annual Rent Increase" help="Can the landlord increase rent during the tenancy?">
        <div className="space-y-2">
          <RadioOption value="NO_INCREASE" current={data.rentIncreaseTerms} onChange={(v) => onChange({ rentIncreaseTerms: v })} label="No rent increase during this tenancy" />
          <RadioOption value="FIXED_PERCENT" current={data.rentIncreaseTerms} onChange={(v) => onChange({ rentIncreaseTerms: v })} label="Fixed annual percentage increase" />
          <RadioOption value="MUTUAL_AGREEMENT" current={data.rentIncreaseTerms} onChange={(v) => onChange({ rentIncreaseTerms: v })} label="By mutual written agreement only" />
        </div>
        {data.rentIncreaseTerms === 'FIXED_PERCENT' && (
          <div className="mt-3 ml-7">
            <NumberInput
              label="Annual increase (%)"
              value={data.rentIncreasePercent}
              onChange={(v) => onChange({ rentIncreasePercent: v })}
              min={0}
              max={20}
              suffix="% per year"
              placeholder="e.g. 5"
            />
          </div>
        )}
      </FieldGroup>
    </WizardStepLayout>
  );
}
