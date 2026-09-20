import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from './LoginForm';

const FEATURES = [
  {
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI-Generated Agreements',
    description: 'Structured tenancy contracts drafted in minutes by Gemini AI — in English and Bahasa Malaysia.',
  },
  {
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Blockchain-Anchored',
    description: 'Every signed agreement is hashed and anchored to the Ethereum Sepolia network — tamper-proof and verifiable.',
  },
  {
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'End-to-End Protection',
    description: 'Payment tracking, condition reports, and deposit refund workflows — landlords and tenants both covered.',
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const isSuspended = params.reason === 'suspended';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f172a] flex flex-col lg:flex-row">

      {/* ── Left marketing panel (desktop only) ── */}
      <div className="hidden lg:flex lg:flex-1 relative flex-col justify-between p-12 xl:p-16 border-r border-[rgba(196,154,60,0.12)]">

        {/* Background subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(196,154,60,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(196,154,60,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow orb */}
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-[rgba(196,154,60,0.05)] blur-3xl" />

        {/* Brand wordmark */}
        <div className="relative z-10">
          <p className="font-serif text-lg font-bold tracking-[0.3em] text-[#C49A3C] uppercase">RentalEase</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/25">Malaysia</p>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 max-w-sm">
          <h1 className="font-serif text-4xl font-bold leading-tight text-white xl:text-5xl">
            Tenancy agreements,{' '}
            <span className="text-[#C49A3C]">simplified.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/45">
            The smarter way to manage rental properties in Malaysia — from invite to signed agreement to final refund.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(196,154,60,0.25)] bg-[rgba(196,154,60,0.1)] text-[#C49A3C]">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/40">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom footnote */}
        <p className="relative z-10 text-[10px] text-white/20 tracking-wide">
          RentalEase Malaysia &nbsp;·&nbsp; Asia Pacific University · FYP 2026
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-12 xl:px-16">

        {/* Decorative gold rings — top right (mobile only atmosphere) */}
        <div className="pointer-events-none absolute -top-24 -right-24 lg:hidden">
          <div className="h-[400px] w-[400px] rounded-full border border-[rgba(196,154,60,0.08)]" />
          <div className="absolute inset-10 rounded-full border border-[rgba(196,154,60,0.06)]" />
        </div>

        {/* Glass card */}
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[rgba(196,154,60,0.25)] bg-[rgba(28,39,64,0.75)] p-8 shadow-2xl backdrop-blur-md">
          {/* Logo (shown on mobile; desktop uses left panel) */}
          <div className="mb-8 text-center lg:hidden">
            <p className="font-serif text-base font-bold tracking-[0.3em] text-[#C49A3C] uppercase">
              RentalEase
            </p>
            <div className="mx-auto mt-2 h-px w-10 bg-gradient-to-r from-transparent via-[#C49A3C] to-transparent" />
            <p className="mt-2 text-[10px] uppercase tracking-widest text-white/30">Malaysia</p>
          </div>

          {/* Desktop form heading (replaces logo on large screens) */}
          <div className="mb-8 hidden lg:block">
            <h2 className="font-serif text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-1 text-sm text-white/40">Sign in to your account to continue.</p>
          </div>

          {isSuspended && (
            <div className="mb-6 rounded-lg border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.08)] px-4 py-3 text-sm text-[#facc15]">
              Your account has been suspended. Please contact the platform administrator.
            </div>
          )}

          <Suspense
            fallback={
              <div className="space-y-5 animate-pulse">
                <div className="h-10 rounded-lg bg-white/5" />
                <div className="h-10 rounded-lg bg-white/5" />
                <div className="h-10 rounded-lg bg-white/5" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-white/40">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#C49A3C] hover:text-[#E8B84B] transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
