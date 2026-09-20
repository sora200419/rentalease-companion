'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  tenancyId: string;
  label: string;
  variant: 'primary' | 'secondary';
}

export default function GenerateAgreementButton({
  tenancyId,
  label,
  variant,
}: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/agreements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenancyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Generation failed. Please try again.');
        return;
      }

      // Refresh the server component so the new agreement data appears
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const baseClass =
    'text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClass =
    variant === 'primary'
      ? 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 text-[#1C2740]'
      : 'border border-white/10 text-white/60 hover:bg-white/5';

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className={`${baseClass} ${variantClass}`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Generating with AI…
          </span>
        ) : (
          label
        )}
      </button>
      {error && <p className="text-[#f87171] text-xs mt-2">{error}</p>}
    </div>
  );
}
