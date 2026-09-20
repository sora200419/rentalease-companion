'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MALAYSIAN_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'W.P. Kuala Lumpur',
  'W.P. Labuan',
  'W.P. Putrajaya',
];

const PROPERTY_TYPES = [
  'Apartment',
  'Condominium',
  'Terrace House',
  'Semi-Detached House',
  'Bungalow',
  'Studio',
  'Townhouse',
  'Service Apartment',
];

// Phase 10: no bedrooms, bathrooms, or rentAmount here — those live on Room
const propertySchema = z.object({
  address: z.string().min(5, 'Please enter a full street address'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(1, 'Please select a state'),
  postcode: z.string().regex(/^\d{5}$/, 'Postcode must be exactly 5 digits'),
  type: z.string().min(1, 'Please select a property type'),
  description: z.string().optional(),
});

type PropertyFormInput = z.input<typeof propertySchema>;
type PropertyFormOutput = z.output<typeof propertySchema>;

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-white/40 text-xs mt-1">{hint}</p>}
      {error && <p className="text-[#f87171] text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function NewPropertyPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormInput, unknown, PropertyFormOutput>({
    resolver: zodResolver(propertySchema),
  });

  const onSubmit = async (data: PropertyFormOutput) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setServerError(result.error || 'Failed to add property');
        return;
      }
      // Redirect to property detail so landlord can immediately add rooms
      router.push(`/dashboard/landlord/properties/${result.property.id}`);
      router.refresh();
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
        <Link
          href="/dashboard/landlord/properties"
          className="hover:text-[#C49A3C] transition-colors"
        >
          Properties
        </Link>
        <span>/</span>
        <span className="text-white/70 font-medium">Add New Property</span>
      </div>

      <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-8">
        <h1 className="text-xl font-bold text-white mb-1">
          Add New Property
        </h1>
        <p className="text-white/40 text-sm mb-7">
          Enter the property address and type. After saving, you&apos;ll add
          individual rooms with their rent amounts.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              Location
            </p>
            <div className="space-y-4">
              <Field label="Street Address" error={errors.address?.message}>
                <input
                  {...register('address')}
                  placeholder="e.g. No. 12, Jalan Bukit Bintang"
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={errors.city?.message}>
                  <input
                    {...register('city')}
                    placeholder="e.g. Kuala Lumpur"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Postcode"
                  error={errors.postcode?.message}
                  hint="5-digit Malaysian postcode"
                >
                  <input
                    {...register('postcode')}
                    placeholder="e.g. 50450"
                    maxLength={5}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="State" error={errors.state?.message}>
                <select {...register('state')} className={`${inputClass} bg-[#1C2740]`}>
                  <option value="">Select a state</option>
                  {MALAYSIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
              Property Details
            </p>
            <div className="space-y-4">
              <Field label="Property Type" error={errors.type?.message}>
                <select {...register('type')} className={`${inputClass} bg-[#1C2740]`}>
                  <option value="">Select property type</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Description (optional)"
                error={errors.description?.message}
              >
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Any additional details"
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </div>
          </div>

          <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-lg px-4 py-3">
            <p className="text-sm font-medium text-[#C49A3C]">
              What happens after you save?
            </p>
            <p className="text-xs text-[#C49A3C] mt-1">
              You&apos;ll be taken to the property detail page where you can add
              rooms (e.g. &ldquo;Entire Unit&rdquo;, &ldquo;Master Room&rdquo;)
              with individual rent amounts.
            </p>
          </div>

          {serverError && (
            <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard/landlord/properties"
              className="flex-1 text-center border border-white/10 text-white/60 hover:bg-white/5 font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {isLoading ? 'Saving...' : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
