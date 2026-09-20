'use client';

import { WizardStepLayout, FieldGroup, RadioOption, TextInput } from './WizardStepLayout';
import type { WizardFormData } from './WizardTypes';

interface Props {
  data: WizardFormData;
  onChange: (updates: Partial<WizardFormData>) => void;
  roomMeta: { wifiIncluded: boolean; waterIncluded: boolean; electricIncluded: boolean };
}

export function Step2Utilities({ data, onChange, roomMeta }: Props) {
  const allIncluded = roomMeta.wifiIncluded && roomMeta.waterIncluded && roomMeta.electricIncluded;
  const hasExcluded = !roomMeta.wifiIncluded || !roomMeta.waterIncluded || !roomMeta.electricIncluded;

  return (
    <WizardStepLayout
      step={2}
      title="Utilities & Services"
      description="Define how utility bills and maintenance services are handled."
    >
      {/* Utility inclusion summary from room */}
      <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3 text-sm text-[#C49A3C]">
        <p className="font-semibold mb-1">Utilities included in rent (from room setup):</p>
        <ul className="list-disc list-inside text-[#C49A3C] space-y-0.5">
          <li>WiFi / Internet: {roomMeta.wifiIncluded ? 'Included' : 'Not included'}</li>
          <li>Water: {roomMeta.waterIncluded ? 'Included' : 'Not included'}</li>
          <li>Electricity: {roomMeta.electricIncluded ? 'Included' : 'Not included'}</li>
        </ul>
      </div>

      {hasExcluded && (
        <FieldGroup
          label="Payment arrangement for excluded utilities"
          help="For utilities not included in rent, who pays the service provider?"
        >
          <div className="space-y-2">
            <RadioOption
              value="DIRECT_TO_PROVIDER"
              current={data.utilityPaymentMethod}
              onChange={(v) => onChange({ utilityPaymentMethod: v })}
              label="Tenant pays provider directly"
              description="Tenant sets up their own accounts and pays utility companies directly."
            />
            <RadioOption
              value="REIMBURSE_LANDLORD"
              current={data.utilityPaymentMethod}
              onChange={(v) => onChange({ utilityPaymentMethod: v })}
              label="Tenant reimburses landlord monthly"
              description="Landlord pays the bill then invoices the tenant based on usage."
            />
          </div>
        </FieldGroup>
      )}

      {allIncluded && (
        <div className="text-sm text-white/50 italic">All utilities are included — payment arrangement not applicable.</div>
      )}

      <FieldGroup label="Utility bill dispute resolution" help="If there is a dispute over the utility bill amount:">
        <div className="space-y-2">
          <RadioOption value="OVER_TYPICAL" current={data.utilityDisputeMethod} onChange={(v) => onChange({ utilityDisputeMethod: v })} label="Tenant responsible for any usage above typical baseline" />
          <RadioOption value="SPLIT_50_50" current={data.utilityDisputeMethod} onChange={(v) => onChange({ utilityDisputeMethod: v })} label="Split 50/50 between landlord and tenant" />
          <RadioOption value="LANDLORD_FINAL" current={data.utilityDisputeMethod} onChange={(v) => onChange({ utilityDisputeMethod: v })} label="Landlord's decision is final" />
        </div>
      </FieldGroup>

      {roomMeta.wifiIncluded && (
        <FieldGroup label="Internet / WiFi details (optional)" help="Provider details for the included internet.">
          <div className="flex flex-col gap-3">
            <TextInput
              label="Internet provider name"
              value={data.internetProvider}
              onChange={(v) => onChange({ internetProvider: v })}
              placeholder="e.g. Unifi, Maxis, Time"
            />
            <div>
              <p className="text-sm font-medium text-white/70 mb-1">Account managed by:</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { value: 'LANDLORD', label: 'Landlord' },
                  { value: 'TENANT', label: 'Tenant' },
                  { value: 'SHARED', label: 'Shared' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ internetAccountManager: opt.value })}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      data.internetAccountManager === opt.value
                        ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)] text-[#C49A3C]'
                        : 'border-white/10 text-white/70 hover:border-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FieldGroup>
      )}

      <FieldGroup label="Air-Conditioning Servicing" help="Who is responsible for routine AC cleaning and maintenance?">
        <div className="space-y-2">
          <RadioOption value="LANDLORD_HANDLES_PAYS" current={data.acServicing} onChange={(v) => onChange({ acServicing: v })} label="Landlord arranges and pays" />
          <RadioOption value="LANDLORD_HANDLES_TENANT_PAYS" current={data.acServicing} onChange={(v) => onChange({ acServicing: v })} label="Landlord arranges, tenant pays cost" />
          <RadioOption value="TENANT" current={data.acServicing} onChange={(v) => onChange({ acServicing: v })} label="Tenant arranges and pays" />
        </div>
      </FieldGroup>

      <FieldGroup label="Pest Control" help="Who handles routine pest control for the unit?">
        <div className="space-y-2">
          <RadioOption value="LANDLORD_HANDLES_PAYS" current={data.pestControl} onChange={(v) => onChange({ pestControl: v })} label="Landlord arranges and pays" />
          <RadioOption value="LANDLORD_HANDLES_TENANT_PAYS" current={data.pestControl} onChange={(v) => onChange({ pestControl: v })} label="Landlord arranges, tenant pays cost" />
          <RadioOption value="TENANT" current={data.pestControl} onChange={(v) => onChange({ pestControl: v })} label="Tenant arranges and pays" />
        </div>
      </FieldGroup>
    </WizardStepLayout>
  );
}
