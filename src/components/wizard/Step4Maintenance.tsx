'use client';

import { WizardStepLayout, FieldGroup, RadioOption, NumberInput } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}

const RESPONSIBLE_OPTIONS = [
  { value: 'TENANT', label: 'Tenant pays' },
  { value: 'LANDLORD', label: 'Landlord pays' },
  { value: 'SPLIT', label: 'Split equally' },
  { value: 'DEPENDS', label: 'Depends on cause' },
];

function ResponsibleGroup({
  label,
  field,
  data,
  onChange,
}: {
  label: string;
  field: keyof WizardFormData;
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
}) {
  return (
    <div className="border border-[rgba(196,154,60,0.15)] rounded-lg p-4">
      <p className="text-sm font-semibold text-white/70 mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {RESPONSIBLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ [field]: opt.value })}
            className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              data[field] === opt.value
                ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                : 'border-white/10 text-white/70 hover:border-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Step4Maintenance({ data, onChange }: Props) {
  return (
    <WizardStepLayout
      step={4}
      title="Maintenance & Repairs"
      description="Specify who is responsible for different types of repairs and maintenance."
    >
      <FieldGroup label="Minor Repair Threshold" help="Repairs under this amount are the tenant's responsibility.">
        <NumberInput
          value={data.minorRepairThreshold}
          onChange={(v) => onChange({ minorRepairThreshold: v ?? 200 })}
          min={0}
          prefix="RM"
          placeholder="200"
        />
      </FieldGroup>

      <FieldGroup label="Repair Responsibility Matrix">
        <div className="space-y-3">
          <ResponsibleGroup
            label={`Minor repairs (under RM ${data.minorRepairThreshold})`}
            field="minorRepairResponsible"
            data={data}
            onChange={onChange}
          />
          <ResponsibleGroup
            label="Plumbing repairs"
            field="plumbingResponsible"
            data={data}
            onChange={onChange}
          />
          <ResponsibleGroup
            label="Electrical repairs"
            field="electricalResponsible"
            data={data}
            onChange={onChange}
          />
          <ResponsibleGroup
            label="Appliance repairs (landlord-provided)"
            field="applianceResponsible"
            data={data}
            onChange={onChange}
          />
          <ResponsibleGroup
            label="Structural damage"
            field="structuralResponsible"
            data={data}
            onChange={onChange}
          />
        </div>
      </FieldGroup>

      <FieldGroup label="Urgent Repair Response Time" help="Landlord's commitment to respond to urgent issues.">
        <div className="space-y-2">
          {[
            { value: '24H', label: 'Within 24 hours' },
            { value: '48H', label: 'Within 48 hours' },
            { value: '72H', label: 'Within 72 hours' },
            { value: '7D', label: 'Within 7 days' },
          ].map((opt) => (
            <RadioOption
              key={opt.value}
              value={opt.value}
              current={data.urgentResponseTime}
              onChange={(v) => onChange({ urgentResponseTime: v })}
              label={opt.label}
            />
          ))}
        </div>
      </FieldGroup>
    </WizardStepLayout>
  );
}
