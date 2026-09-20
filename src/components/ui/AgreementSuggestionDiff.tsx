'use client';

import { useMemo, useState } from 'react';
import { buildAgreementDiff, type DiffRow } from '@/lib/agreements/textDiff';

interface Props {
  currentContent: string;
  suggestedContent: string;
  instruction?: string;
}

function getBlockStyles(
  side: 'current' | 'suggested',
  type: DiffRow['type'],
): string {
  if (type === 'unchanged') {
    return 'border border-[rgba(196,154,60,0.12)] bg-[#161f30] text-white/60';
  }

  if (type === 'modified') {
    return side === 'current'
      ? 'border-l-2 border-l-amber-400 border border-amber-400/30 bg-amber-950/40 text-amber-100'
      : 'border-l-2 border-l-emerald-400 border border-emerald-400/30 bg-emerald-950/40 text-emerald-100';
  }

  if (type === 'removed') {
    return side === 'current'
      ? 'border-l-2 border-l-rose-400 border border-rose-400/30 bg-rose-950/40 text-rose-100'
      : 'border border-dashed border-white/10 bg-white/[0.02] text-white/30';
  }

  // added
  return side === 'suggested'
    ? 'border-l-2 border-l-emerald-400 border border-emerald-400/30 bg-emerald-950/40 text-emerald-100'
    : 'border border-dashed border-white/10 bg-white/[0.02] text-white/30';
}

function getBadgeStyles(type: DiffRow['type']): string {
  if (type === 'unchanged') {
    return 'bg-white/5 text-white/40';
  }

  if (type === 'modified') {
    return 'bg-amber-400/15 text-amber-300';
  }

  if (type === 'removed') {
    return 'bg-rose-400/15 text-rose-300';
  }

  // added
  return 'bg-emerald-400/15 text-emerald-300';
}

function getBadgeLabel(type: DiffRow['type']): string {
  if (type === 'modified') return 'Changed';
  if (type === 'added') return 'Added';
  if (type === 'removed') return 'Removed';
  return 'Unchanged';
}

function renderBlock(text: string | null, emptyLabel: string) {
  if (!text) {
    return <p className="text-xs italic leading-relaxed">{emptyLabel}</p>;
  }

  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
      {text}
    </pre>
  );
}

function getBlockTitle(row: DiffRow): string {
  const source = row.suggestedText ?? row.currentText ?? '';
  const firstLine = source
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return 'Updated section';
  }

  return firstLine.length > 88 ? `${firstLine.slice(0, 88)}...` : firstLine;
}

export default function AgreementSuggestionDiff({
  currentContent,
  suggestedContent,
  instruction,
}: Props) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const { rows, summary } = buildAgreementDiff(currentContent, suggestedContent);
  const visibleRows = useMemo(
    () => (showUnchanged ? rows : rows.filter((row) => row.type !== 'unchanged')),
    [rows, showUnchanged],
  );
  const changedRows = useMemo(
    () => rows.filter((row) => row.type !== 'unchanged'),
    [rows],
  );

  return (
    <div className="bg-[#1C2740]">
      <div className="border-b border-[rgba(196,154,60,0.2)] px-4 py-4">
        <p className="text-sm font-semibold text-white">
          {summary.changedBlocks === 0
            ? 'No visible text changes detected'
            : `${summary.changedBlocks} changed block${summary.changedBlocks === 1 ? '' : 's'} detected`}
        </p>
        <p className="text-xs text-white/50 mt-1">
          Left shows the current agreement. Right shows the AI suggestion.
          Changed blocks are highlighted before you apply anything to the editor.
        </p>
        {instruction ? (
          <p className="mt-2 text-xs text-[#C49A3C]">
            <span className="font-semibold">Instruction applied:</span>{' '}
            {instruction}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-medium">
          <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-300">
            {summary.modifiedBlocks} changed
          </span>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-300">
            {summary.addedBlocks} added
          </span>
          <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-rose-300">
            {summary.removedBlocks} removed
          </span>
        </div>
        {changedRows.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[rgba(196,154,60,0.2)] bg-[rgba(196,154,60,0.05)] px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C49A3C]">
              Changed Sections
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {changedRows.map((row, index) => (
                <span
                  key={`summary-${index}`}
                  className="rounded-full border border-[rgba(196,154,60,0.3)] bg-[rgba(196,154,60,0.08)] px-2.5 py-1 text-[11px] text-[#E8B84B]"
                >
                  {getBlockTitle(row)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <label className="mt-3 inline-flex items-center gap-2 text-xs text-white/50 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(event) => setShowUnchanged(event.target.checked)}
            className="h-4 w-4 accent-[#C49A3C]"
          />
          Show unchanged blocks
        </label>
      </div>

      <div className="grid gap-3 px-4 py-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
            Current Agreement
          </p>
          <div className="space-y-3">
            {visibleRows.map((row, index) => (
              <div
                key={`current-${index}`}
                className={`rounded-lg px-3 py-3 ${getBlockStyles('current', row.type)}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBadgeStyles(row.type)}`}
                  >
                    {getBadgeLabel(row.type)}
                  </span>
                  <span className="text-[11px] text-white/40">
                    Block {index + 1}
                  </span>
                </div>
                {renderBlock(row.currentText, 'No matching text in current version.')}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
            AI Suggested Agreement
          </p>
          <div className="space-y-3">
            {visibleRows.map((row, index) => (
              <div
                key={`suggested-${index}`}
                className={`rounded-lg px-3 py-3 ${getBlockStyles('suggested', row.type)}`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getBadgeStyles(row.type)}`}
                  >
                    {getBadgeLabel(row.type)}
                  </span>
                  <span className="text-[11px] text-white/40">
                    Block {index + 1}
                  </span>
                </div>
                {renderBlock(row.suggestedText, 'No matching text in suggested version.')}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
