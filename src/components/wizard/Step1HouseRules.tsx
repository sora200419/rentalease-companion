'use client';

import { WizardStepLayout, FieldGroup, RadioOption, NumberInput, TextInput } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

export function Step1HouseRules({ data, onChange }: Props) {
  return (
    <WizardStepLayout
      step={1}
      title="House Rules & Occupancy"
      description="Set the basic rules for how tenants can use the property."
    >
      <FieldGroup label="Pets" help="What pets, if any, may tenants keep?">
        <div className="space-y-2">
          {[
            { value: 'NONE', label: 'No pets permitted' },
            { value: 'CATS_ONLY', label: 'Cats only' },
            { value: 'DOGS_ONLY', label: 'Dogs only' },
            { value: 'APPROVAL', label: 'Any pet with written landlord approval' },
            { value: 'UNRESTRICTED', label: 'Any pets permitted' },
          ].map((opt) => (
            <RadioOption key={opt.value} value={opt.value} current={data.petsPolicy} onChange={(v) => onChange({ petsPolicy: v })} label={opt.label} />
          ))}
        </div>
        {data.petsPolicy !== 'NONE' && (
          <div className="mt-3 ml-7 flex flex-wrap gap-4">
            <NumberInput
              label="Max pets allowed"
              value={data.petsMaxCount}
              onChange={(v) => onChange({ petsMaxCount: v })}
              min={1}
              max={10}
              placeholder="e.g. 2"
            />
            <NumberInput
              label="Pet deposit (RM, optional)"
              value={data.petsDeposit}
              onChange={(v) => onChange({ petsDeposit: v })}
              min={0}
              prefix="RM"
              placeholder="e.g. 300"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Smoking Policy">
        <div className="space-y-2">
          {[
            { value: 'NOT_ANYWHERE', label: 'No smoking anywhere on the premises' },
            { value: 'BALCONY_ONLY', label: 'Smoking on balcony or outdoor areas only' },
            { value: 'NOT_INDOORS', label: 'Not indoors, permitted outdoors' },
            { value: 'ANYWHERE', label: 'Smoking permitted anywhere' },
          ].map((opt) => (
            <RadioOption key={opt.value} value={opt.value} current={data.smokingPolicy} onChange={(v) => onChange({ smokingPolicy: v })} label={opt.label} />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="Overnight Guests" help="How many nights per month may guests stay?">
        <div className="space-y-2">
          {[
            { value: 'UNRESTRICTED', label: 'No restriction on overnight guests' },
            { value: 'LIMITED', label: 'Limited — specify maximum nights per month' },
            { value: 'NOTIFICATION', label: 'Permitted but tenant must notify landlord first' },
            { value: 'NOT_ALLOWED', label: 'Overnight guests not permitted' },
          ].map((opt) => (
            <RadioOption key={opt.value} value={opt.value} current={data.overnightGuests} onChange={(v) => onChange({ overnightGuests: v })} label={opt.label} />
          ))}
        </div>
        {data.overnightGuests === 'LIMITED' && (
          <div className="mt-3 ml-7">
            <NumberInput
              label="Max nights per month"
              value={data.overnightMaxNights}
              onChange={(v) => onChange({ overnightMaxNights: v })}
              min={1}
              max={28}
              suffix="nights/month"
              placeholder="e.g. 14"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Quiet Hours">
        <div className="space-y-2">
          {[
            { value: 'STANDARD', label: 'Standard (10:00 PM – 7:00 AM daily)' },
            { value: 'CUSTOM', label: 'Custom hours' },
            { value: 'NONE', label: 'No specific quiet hours policy' },
          ].map((opt) => (
            <RadioOption key={opt.value} value={opt.value} current={data.quietHoursPolicy} onChange={(v) => onChange({ quietHoursPolicy: v })} label={opt.label} />
          ))}
        </div>
        {data.quietHoursPolicy === 'CUSTOM' && (
          <div className="mt-3 ml-7">
            <TextInput
              label="Custom quiet hours (e.g. 9:00 PM – 6:00 AM)"
              value={data.quietHoursCustom}
              onChange={(v) => onChange({ quietHoursCustom: v })}
              placeholder="e.g. 9:00 PM – 6:00 AM"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Additional House Rules (optional)" help="Any other rules you want included verbatim in the agreement.">
        <TextInput
          value={data.additionalHouseRules}
          onChange={(v) => onChange({ additionalHouseRules: v })}
          placeholder="e.g. No musical instruments after 9 PM. Laundry to be dried inside the unit only."
          multiline
        />
      </FieldGroup>
    </WizardStepLayout>
  );
}
