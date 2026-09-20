import Link from 'next/link';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C49A3C]">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-white/50">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type AttentionHeroProps = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  secondary?: ReactNode;
};

export function AttentionHero({
  title,
  description,
  actionLabel,
  href,
  secondary,
}: AttentionHeroProps) {
  return (
    <section className="mb-6 rounded-2xl border border-[rgba(196,154,60,0.3)] bg-gradient-to-br from-[rgba(196,154,60,0.12)] to-[rgba(196,154,60,0.04)] p-5">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C49A3C]">
            Action Required
          </p>
          <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/50">{description}</p>
          <Link
            href={href}
            className="mt-4 inline-flex rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2.5 text-sm font-bold text-[#1C2740] transition-opacity hover:opacity-90"
          >
            {actionLabel}
          </Link>
        </div>
        {secondary && (
          <div className="rounded-xl border border-[rgba(196,154,60,0.2)] bg-[rgba(255,255,255,0.04)] p-4">
            {secondary}
          </div>
        )}
      </div>
    </section>
  );
}

type StatCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'default' | 'blue' | 'green' | 'amber' | 'red';
};

const toneText = {
  default: 'text-white',
  blue: 'text-[#C49A3C]',
  green: 'text-[#4ade80]',
  amber: 'text-[#E8B84B]',
  red: 'text-[#f87171]',
};

export function StatCard({ label, value, detail, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[rgba(196,154,60,0.2)] bg-[#1C2740] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/35">{label}</p>
      <p className={`mt-2 truncate font-serif text-2xl font-bold ${toneText[tone]}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-white/30">{detail}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740]${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(196,154,60,0.12)] px-5 py-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#1C2740] p-12 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-white/40">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
