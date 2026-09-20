'use client';

// Shared layout wrapper for each wizard step — heading, description, children.

interface WizardStepLayoutProps {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function WizardStepLayout({ step, title, description, children }: WizardStepLayoutProps) {
  return (
    <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold text-[#C49A3C] uppercase tracking-wider mb-1">
          Step {step} of 6
        </p>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-white/50 mt-1">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

// Reusable field group wrapper
export function FieldGroup({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white/70 mb-1">{label}</p>
      {help && <p className="text-xs text-white/40 mb-2">{help}</p>}
      {children}
    </div>
  );
}

// Radio option button
export function RadioOption({
  value,
  current,
  onChange,
  label,
  description,
}: {
  value: string;
  current: string;
  onChange: (v: string) => void;
  label: string;
  description?: string;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
        selected
          ? 'border-[#C49A3C] bg-[rgba(196,154,60,0.06)]'
          : 'border-white/10 hover:border-white/10 bg-[#1C2740]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
            selected ? 'border-[#C49A3C] bg-[#C49A3C]' : 'border-white/40'
          }`}
        >
          {selected && <div className="w-2 h-2 m-0.5 bg-[#1C2740] rounded-full" />}
        </div>
        <div>
          <p className={`text-sm font-medium ${selected ? 'text-[#C49A3C]' : 'text-white'}`}>{label}</p>
          {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
        </div>
      </div>
    </button>
  );
}

// Number input
export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
  placeholder,
}: {
  label?: string;
  value: number | null | '';
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-white/50">{prefix}</span>}
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors w-32"
        />
        {suffix && <span className="text-sm text-white/50">{suffix}</span>}
      </div>
    </div>
  );
}

// Text input
export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
        />
      )}
    </div>
  );
}

// Checkbox group
export function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="w-4 h-4 accent-[#C49A3C] rounded border-white/10"
          />
          <span className="text-sm text-white/70">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
