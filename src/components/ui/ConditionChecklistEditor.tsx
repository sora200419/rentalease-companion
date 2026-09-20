'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_AREAS = [
  'Bedroom / Rented Room',
  'Bathroom',
  'Kitchen / Shared Area',
  'Door, Lock and Keys',
  'Walls, Floor and Ceiling',
  'Furniture / Appliances',
];

const REASON_OPTIONS = [
  { value: 'PHOTO_UPLOADED', label: 'Photo uploaded' },
  { value: 'NO_ISSUE_OBSERVED', label: 'No issue observed' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
  { value: 'CANNOT_ACCESS', label: 'Cannot access' },
] as const;

type CompletionReason = (typeof REASON_OPTIONS)[number]['value'];

interface ChecklistItem {
  area: string;
  completionReason: CompletionReason;
}

interface Props {
  reportId: string;
  existingItems: ChecklistItem[];
}

export default function ConditionChecklistEditor({
  reportId,
  existingItems,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedAreas = new Map(
    existingItems.map((i) => [i.area, i.completionReason]),
  );

  const handleSelect = async (area: string, completionReason: CompletionReason) => {
    setSaving(area);
    setError(null);

    try {
      const res = await fetch(
        `/api/condition-reports/${reportId}/checklist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ area, completionReason }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to save. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <p className="text-sm font-semibold text-white/70 mb-1">
        Evidence Checklist
      </p>
      <p className="text-xs text-white/50 mb-4">
        Mark how you have documented each required area.
      </p>

      <div className="space-y-3">
        {DEFAULT_AREAS.map((area) => {
          const current = completedAreas.get(area);
          const isSaving = saving === area;

          return (
            <div key={area} className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${current ? 'bg-green-500' : 'bg-white/30'}`}
              />
              <span className="text-sm text-white/70 flex-1 min-w-0 truncate">
                {area}
              </span>
              <select
                value={current ?? ''}
                onChange={(e) =>
                  handleSelect(area, e.target.value as CompletionReason)
                }
                disabled={isSaving}
                className="text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[rgba(196,154,60,0.5)] focus:ring-0 disabled:opacity-50 bg-[#1C2740] text-white border border-white/10 transition-colors"
              >
                <option value="" disabled>
                  Select…
                </option>
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {error && <p className="text-[#f87171] text-xs mt-3">{error}</p>}
    </div>
  );
}
