'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { PasswordInput } from '@/components/ui/PasswordInput';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-4 py-4 text-sm text-[#f87171]">
        Invalid reset link. Please request a new one.{' '}
        <Link href="/forgot-password" className="underline font-medium text-[#C49A3C] hover:text-[#E8B84B] transition-colors">Try again</Link>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setServerError(json.error || 'Something went wrong');
        return;
      }

      router.push('/login?reset=true');
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <PasswordInput
        registration={register('password')}
        label="New Password"
        placeholder="Min. 8 characters"
        error={errors.password?.message}
      />
      <PasswordInput
        registration={register('confirm')}
        label="Confirm New Password"
        placeholder="Re-enter your new password"
        error={errors.confirm?.message}
      />

      {serverError && (
        <div className="flex items-start gap-3 rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] py-2.5 text-sm font-bold text-[#1C2740] transition-opacity disabled:opacity-50 hover:opacity-90"
      >
        {isLoading ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f172a] flex items-center justify-center px-4 py-12">
      {/* Decorative gold rings — top right */}
      <div className="pointer-events-none absolute -top-24 -right-24">
        <div className="h-[400px] w-[400px] rounded-full border border-[rgba(196,154,60,0.08)]" />
        <div className="absolute inset-10 rounded-full border border-[rgba(196,154,60,0.06)]" />
      </div>
      {/* Decorative gold rings — bottom left */}
      <div className="pointer-events-none absolute -bottom-16 -left-16">
        <div className="h-[300px] w-[300px] rounded-full border border-[rgba(196,154,60,0.06)]" />
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[rgba(196,154,60,0.25)] bg-[rgba(28,39,64,0.75)] p-8 shadow-2xl backdrop-blur-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <p className="font-serif text-base font-bold tracking-[0.3em] text-[#C49A3C] uppercase">RentalEase</p>
          <div className="mx-auto mt-2 h-px w-10 bg-gradient-to-r from-transparent via-[#C49A3C] to-transparent" />
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/30">Malaysia</p>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
        <p className="text-sm text-white/50 mb-8">Choose a new password for your account.</p>

        <Suspense fallback={
          <div className="space-y-5 animate-pulse">
            <div className="h-10 bg-white/5 rounded-lg" />
            <div className="h-10 bg-white/5 rounded-lg" />
            <div className="h-10 bg-white/5 rounded-lg" />
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>

        <p className="text-center text-sm text-white/50 mt-6">
          <Link href="/login" className="text-[#C49A3C] hover:text-[#E8B84B] transition-colors font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
