'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PasswordInput } from '@/components/ui/PasswordInput';

const IC_REGEX = /^\d{6}-?\d{2}-?\d{4}$/;

function isValidIcDate(ic: string): boolean {
  const digits = ic.replace(/-/g, '');
  const mm = parseInt(digits.slice(2, 4), 10);
  const dd = parseInt(digits.slice(4, 6), 10);
  const yy = parseInt(digits.slice(0, 2), 10);
  const currentYY = new Date().getFullYear() % 100;
  const year = yy > currentYY ? 1900 + yy : 2000 + yy;
  const date = new Date(year, mm - 1, dd);
  return date.getFullYear() === year && date.getMonth() === mm - 1 && date.getDate() === dd;
}

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['LANDLORD', 'TENANT']),
    phone: z.string().min(1, 'Phone number is required'),
    icNumber: z
      .string()
      .min(1, 'IC number is required')
      .regex(IC_REGEX, 'Invalid format - e.g. 900101-14-5678')
      .refine(isValidIcDate, 'Invalid date in IC number'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const INPUT = 'w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';
const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-white/40';

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'TENANT' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const { confirmPassword: _, ...fields } = data;
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== '') formData.append(key, value);
      });

      const response = await fetch('/api/register', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || 'Registration failed');
        return;
      }

      router.push('/login?registered=true');
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f172a] flex items-center justify-center px-4 py-12">
      {/* Decorative gold rings — top right */}
      <div className="pointer-events-none absolute -top-24 -right-24">
        <div className="h-[400px] w-[400px] rounded-full border border-[rgba(196,154,60,0.08)]" />
        <div className="absolute inset-10 rounded-full border border-[rgba(196,154,60,0.06)]" />
        <div className="absolute inset-20 rounded-full border border-[rgba(196,154,60,0.04)]" />
      </div>
      {/* Decorative gold rings — bottom left */}
      <div className="pointer-events-none absolute -bottom-16 -left-16">
        <div className="h-[300px] w-[300px] rounded-full border border-[rgba(196,154,60,0.06)]" />
        <div className="absolute inset-8 rounded-full bg-[rgba(196,154,60,0.02)]" />
      </div>

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[rgba(196,154,60,0.25)] bg-[rgba(28,39,64,0.75)] p-8 shadow-2xl backdrop-blur-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <p className="font-serif text-base font-bold tracking-[0.3em] text-[#C49A3C] uppercase">
            RentalEase
          </p>
          <div className="mx-auto mt-2 h-px w-10 bg-gradient-to-r from-transparent via-[#C49A3C] to-transparent" />
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/30">Malaysia</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className={LABEL}>Full Name</label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g. Ahmad bin Abdullah"
              className={INPUT}
            />
            {errors.name && <p className="mt-1 text-xs text-[#f87171]">{errors.name.message}</p>}
          </div>

          <div>
            <label className={LABEL}>Email Address</label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className={INPUT}
            />
            {errors.email && <p className="mt-1 text-xs text-[#f87171]">{errors.email.message}</p>}
          </div>

          <div>
            <label className={LABEL}>Phone Number</label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="e.g. 012-3456789"
              className={INPUT}
            />
            {errors.phone && <p className="mt-1 text-xs text-[#f87171]">{errors.phone.message}</p>}
          </div>

          <div>
            <label className={LABEL}>
              Malaysian IC Number <span className="text-[#f87171]">*</span>
            </label>
            {(() => {
              const { ref: icRef, onChange: icRhfOnChange, ...icRest } = register('icNumber');
              return (
                <input
                  {...icRest}
                  ref={icRef}
                  type="text"
                  placeholder="e.g. 900101-14-5678"
                  maxLength={14}
                  className={INPUT}
                  onChange={(e) => {
                    const el = e.target;
                    const cursor = el.selectionStart ?? el.value.length;
                    const digits = el.value.replace(/\D/g, '').slice(0, 12);
                    let formatted = digits;
                    if (digits.length > 6) formatted = digits.slice(0, 6) + '-' + digits.slice(6);
                    if (digits.length > 8) formatted = formatted.slice(0, 9) + '-' + digits.slice(8);
                    el.value = formatted;
                    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
                    icRhfOnChange(e);
                  }}
                />
              );
            })()}
            {errors.icNumber ? (
              <p className="mt-1 text-xs text-[#f87171]">{errors.icNumber.message}</p>
            ) : (
              <p className="mt-1 text-xs text-white/25">Format: YYMMDD-SS-NNNN (dashes auto-added)</p>
            )}
          </div>

          <PasswordInput
            registration={register('password')}
            label="Password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
          />
          <PasswordInput
            registration={register('confirmPassword')}
            label="Confirm Password"
            placeholder="Re-enter your password"
            error={errors.confirmPassword?.message}
          />

          <div>
            <label className={LABEL}>I am a…</label>
            <div className="grid grid-cols-2 gap-3">
              {(['TENANT', 'LANDLORD'] as const).map((r) => (
                <label key={r} className="relative flex cursor-pointer">
                  <input {...register('role')} type="radio" value={r} className="sr-only peer" />
                  <div className="w-full text-center py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-white/40 peer-checked:border-[rgba(196,154,60,0.5)] peer-checked:text-[#C49A3C] peer-checked:bg-[rgba(196,154,60,0.08)] transition-all">
                    {r === 'TENANT' ? 'Tenant' : 'Landlord'}
                  </div>
                </label>
              ))}
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
            {isLoading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/40">
          Already have an account?{' '}
          <Link href="/login" className="text-[#C49A3C] hover:text-[#E8B84B] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
