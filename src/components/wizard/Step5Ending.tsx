'use client';

import { WizardStepLayout, FieldGroup, RadioOption, NumberInput } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

function NoticeMonthsSelector({
  label,
  value,
  onChange,
  allowZero,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowZero?: boolean;
}) {
  const options = allowZero
    ? [0, 1, 2, 3]
    : [1, 2, 3];

  return (
    <div>
      <p className="text-sm font-medium text-white/70 mb-2">{label}</p>
      <div className="flex gap-3 flex-wrap">
        {options.map((months) => (
          <button
            key={months}
            type="button"
            onClick={() => onChange(months)}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              value === months
                ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                : 'border-white/10 text-white/70 hover:border-white/10'
            }`}
          >
            {months === 0 ? 'Not allowed except for breach' : `${months} month${months > 1 ? 's' : ''}`}
          </button>
        ))}
        {!options.includes(value) && (
          <button
            type="button"
            className="px-4 py-2 rounded-lg border-2 border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C] text-sm font-medium"
          >
            {value} months
          </button>
        )}
      </div>
    </div>
  );
}

export function Step5Ending({ data, onChange }: Props) {
  return (
    <WizardStepLayout
      step={5}
      title="Ending the Tenancy"
      description="Specify notice periods, early termination rules, and move-out expectations."
    >
      <FieldGroup label="Notice Periods">
        <div className="space-y-4">
          <NoticeMonthsSelector
            label="If the tenant wants to leave early, they must give notice of:"
            value={data.tenantNoticeMonths}
            onChange={(v) => onChange({ tenantNoticeMonths: v })}
          />
          <NoticeMonthsSelector
            label="If the landlord wants vacant possession (excluding breach), notice period is:"
            value={data.landlordNoticeMonths}
            onChange={(v) => onChange({ landlordNoticeMonths: v })}
            allowZero
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Early Termination Penalty" help="What happens if the tenant leaves before the end date?">
        <div className="space-y-2">
          <RadioOption value="NONE" current={data.earlyTerminationPenalty} onChange={(v) => onChange({ earlyTerminationPenalty: v })} label="No penalty" />
          <RadioOption value="FORFEIT_DEPOSIT" current={data.earlyTerminationPenalty} onChange={(v) => onChange({ earlyTerminationPenalty: v })} label="Security deposit is forfeited" />
          <RadioOption value="MONTHS_RENT" current={data.earlyTerminationPenalty} onChange={(v) => onChange({ earlyTerminationPenalty: v })} label="Pay X months rent as penalty" />
          <RadioOption value="PRORATED" current={data.earlyTerminationPenalty} onChange={(v) => onChange({ earlyTerminationPenalty: v })} label="Pro-rated based on remaining term" />
        </div>
        {data.earlyTerminationPenalty === 'MONTHS_RENT' && (
          <div className="mt-3 ml-7">
            <NumberInput
              label="Number of months rent as penalty"
              value={data.earlyTerminationMonths}
              onChange={(v) => onChange({ earlyTerminationMonths: v })}
              min={1}
              max={6}
              suffix="months rent"
              placeholder="e.g. 2"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Move-Out Condition" help="What state must the property be returned in?">
        <div className="space-y-2">
          {[
            { value: 'BROOM_CLEAN', label: 'Broom-clean (swept and rubbish-free)', description: 'Basic tidiness expected' },
            { value: 'PROFESSIONAL_CLEANING', label: 'Professional cleaning required', description: 'Tenant must arrange and pay for professional cleaning' },
            { value: 'ORIGINAL_STATE', label: 'Restore to original condition', description: 'As it was at move-in, documented in the condition report' },
            { value: 'AS_IS', label: 'As-is (except major damage)', description: 'Tenant may leave minor wear and tear' },
          ].map((opt) => (
            <RadioOption
              key={opt.value}
              value={opt.value}
              current={data.reinstatementLevel}
              onChange={(v) => onChange({ reinstatementLevel: v })}
              label={opt.label}
              description={opt.description}
            />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Subletting & Transfer">
        <div className="space-y-2">
          <RadioOption value="NOT_ALLOWED" current={data.sublettingPolicy} onChange={(v) => onChange({ sublettingPolicy: v })} label="Subletting strictly prohibited" />
          <RadioOption value="WITH_CONSENT" current={data.sublettingPolicy} onChange={(v) => onChange({ sublettingPolicy: v })} label="Permitted with prior written landlord consent" />
          <RadioOption value="WITHOUT_CONSENT" current={data.sublettingPolicy} onChange={(v) => onChange({ sublettingPolicy: v })} label="Permitted without landlord consent" />
        </div>
      </FieldGroup>
    </WizardStepLayout>
  );
}
