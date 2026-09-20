'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

interface PasswordInputProps {
  registration: React.InputHTMLAttributes<HTMLInputElement>;
  label: string;
  placeholder: string;
  error?: string;
}

export function PasswordInput({
  registration,
  label,
  placeholder,
  error,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-white/40">
        {label}
      </label>
      <div className="relative">
        <input
          {...registration}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[#f87171]">{error}</p>}
    </div>
  );
}
