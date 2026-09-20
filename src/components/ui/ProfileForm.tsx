'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface Props {
  // Pre-filled from the server component — the current stored values
  initialName: string;
  initialPhone: string | null;
  initialIcNumber: string | null;
  kycStatus: string | null;
  email: string; // shown read-only — cannot be changed here
  role: string;
}

// Formats a raw 12-digit IC string into the human-readable YYMMDD-PB-NNNC format.
// This is purely for display — the API stores and receives the raw 12 digits.
function formatIcDisplay(raw: string): string {
  if (raw.length !== 12) return raw;
  return `${raw.slice(0, 6)}-${raw.slice(6, 8)}-${raw.slice(8)}`;
}

export default function ProfileForm({
  initialName,
  initialPhone,
  initialIcNumber,
  kycStatus,
  email,
  role,
}: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [name, setName] = useState(initialName);
  // Show the IC in formatted display for readability in the input
  const [icNumber, setIcNumber] = useState(
    initialIcNumber ? formatIcDisplay(initialIcNumber) : '',
  );
  const [phone, setPhone] = useState(initialPhone ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // IC is editable only when KYC is rejected — otherwise always locked
  const icLocked = kycStatus !== 'REJECTED';

  // Track whether the user has changed anything so we can disable Save when not needed
  const hasChanges =
    name !== initialName ||
    phone !== (initialPhone ?? '') ||
    icNumber.replace(/-/g, '') !== (initialIcNumber ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const rawIc = icNumber.replace(/-/g, '');
      const icChanged = rawIc !== (initialIcNumber ?? '');

      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
      };
      // Only include icNumber when it has actually changed — sending an unchanged
      // IC in every PATCH would incorrectly reset isVerified on the server.
      if (icChanged) {
        payload.icNumber = icNumber.trim() || null;
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update profile.');
        return;
      }

      setSuccess(true);
      // Push the new name into the JWT token so the sidebar updates immediately
      await updateSession({ name: name.trim() });
      router.refresh();
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Basic Info ──────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">
          Basic Information
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Email Address
            </label>
            {/* Email is read-only — displayed for reference but not editable
                because changing it would require re-validating the NextAuth session */}
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm text-white/30 cursor-not-allowed"
            />
            <p className="text-xs text-white/30 mt-1">
              Email cannot be changed after registration.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 012-3456789"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Identity Verification ───────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">
          Identity Verification
        </p>

        {/* PDPA notice — explaining why we collect this and how it's used.
            This is important for FYP Problem Statement 3 and Objective 3
            around secure document management and PDPA 2010 compliance. */}
        <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-xl px-5 py-4 mb-4">
          <p className="text-[#C49A3C] text-sm font-medium mb-1">
            Why we collect your IC number
          </p>
          <p className="text-white/50 text-xs leading-relaxed">
            Your Malaysian IC (MyKad) number is used solely to populate the
            party identification clause in your tenancy agreement, as required
            under Malaysian tenancy law. This information is stored securely and
            protected under the Personal Data Protection Act 2010 (PDPA). It
            will never be shared with third parties and is only visible to your
            landlord within the generated agreement document.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">
            Malaysian IC Number (MyKad)
          </label>
          {icLocked ? (
            <>
              <input
                type="text"
                value={icNumber}
                disabled
                className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm text-white/30 cursor-not-allowed"
              />
              <p className="text-xs text-white/30 mt-1">
                IC number cannot be changed after saving.
              </p>
            </>
          ) : (
            <>
              <input
                type="text"
                value={icNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                  let formatted = digits;
                  if (digits.length > 6) formatted = digits.slice(0, 6) + '-' + digits.slice(6);
                  if (digits.length > 8) formatted = formatted.slice(0, 9) + '-' + digits.slice(8);
                  setIcNumber(formatted);
                }}
                placeholder="e.g. 901231-14-5678"
                maxLength={14}
                className={inputClass}
              />
              {kycStatus === 'REJECTED' && (
                <p className="text-xs text-[#E8B84B] mt-1">
                  Your KYC was rejected. You may correct your IC number before resubmitting.
                </p>
              )}
            </>
          )}
        </div>

        {/* Role badge */}
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              role === 'LANDLORD'
                ? 'bg-[rgba(196,154,60,0.12)] text-[#C49A3C]'
                : 'bg-[rgba(74,222,128,0.1)] text-[#4ade80]'
            }`}
          >
            {role === 'LANDLORD' ? 'Landlord' : 'Tenant'}
          </span>
          <p className="text-xs text-white/40">
            {role === 'TENANT'
              ? 'Your IC number will appear in tenancy agreements as the Tenant party.'
              : 'Your IC number will appear in tenancy agreements as the Landlord party.'}
          </p>
        </div>
      </div>

      {/* ── Save Controls ───────────────────────────────────────────────── */}
      {error && (
        <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] text-[#f87171] text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] text-[#4ade80] text-sm rounded-lg px-4 py-3">
          Profile updated successfully.
          {icNumber &&
            ' Your IC number will appear in newly generated agreements.'}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving || !hasChanges}
        className="w-full bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] disabled:opacity-40 disabled:cursor-not-allowed text-[#1C2740] font-semibold py-3 rounded-lg transition-opacity hover:opacity-90 text-sm"
      >
        {isSaving ? 'Saving…' : 'Save Profile'}
      </button>
    </form>
  );
}
