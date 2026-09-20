'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PasswordInput } from '@/components/ui/PasswordInput';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';
  const justReset = searchParams.get('reset') === 'true';

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setServerError('Invalid email or password');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <>
      {justRegistered && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-4 py-3 text-sm text-[#4ade80]">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Account created. Please sign in.
        </div>
      )}

      {justReset && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-4 py-3 text-sm text-[#4ade80]">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Password reset successfully. Please sign in with your new password.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
            Email Address
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
          />
          {errors.email && <p className="mt-1 text-xs text-[#f87171]">{errors.email.message}</p>}
        </div>

        <div>
          <PasswordInput
            registration={register('password')}
            label="Password"
            placeholder="Your password"
            error={errors.password?.message}
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-[#C49A3C] hover:text-[#E8B84B] transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>

        {serverError && (
          <div className="flex items-start gap-3 rounded-lg border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[#f87171]">
            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </>
  );
}
