'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ExistingProof {
  id: string;
  imageUrl: string;
}

interface Props {
  tenancyId: string;
  depositStatus: string; // PENDING | UNDER_REVIEW | PAID | REJECTED
  depositRejectionReason?: string | null;
  existingProofs: ExistingProof[];
  depositAmount: string; // pre-formatted RM string
}

export default function DepositProofUploader({
  tenancyId,
  depositStatus,
  depositRejectionReason,
  existingProofs,
  depositAmount,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = depositStatus === 'PENDING' || depositStatus === 'REJECTED';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/tenancies/${tenancyId}/deposit-proof`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? 'Upload failed. Please try again.');
        return;
      }

      setFile(null);
      setPreview(null);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── PAID ──────────────────────────────────────────────────────────────────
  if (depositStatus === 'PAID') {
    return (
      <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.25)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[#4ade80] font-bold text-sm">
            Deposit Confirmed
          </span>
          <span className="text-xs text-white/40">{depositAmount}</span>
        </div>
        {existingProofs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {existingProofs.map((p) => (
              <a
                key={p.id}
                href={p.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block w-16 h-16 rounded-lg overflow-hidden border border-[rgba(74,222,128,0.25)] hover:opacity-80 transition-opacity"
              >
                <Image
                  src={p.imageUrl}
                  alt="Deposit proof"
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── UNDER REVIEW ─────────────────────────────────────────────────────────
  if (depositStatus === 'UNDER_REVIEW') {
    return (
      <div className="bg-[rgba(196,154,60,0.06)] border border-[rgba(196,154,60,0.2)] rounded-xl p-4">
        <p className="text-[#C49A3C] text-sm font-semibold mb-2">
          ⏳ Deposit proof submitted — awaiting landlord confirmation
        </p>
        {existingProofs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {existingProofs.map((p) => (
              <a
                key={p.id}
                href={p.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block w-16 h-16 rounded-lg overflow-hidden border border-[rgba(196,154,60,0.2)] hover:opacity-80 transition-opacity"
              >
                <Image
                  src={p.imageUrl}
                  alt="Deposit proof"
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── PENDING / REJECTED — show upload form ────────────────────────────────
  return (
    <div className="space-y-3">
      {depositStatus === 'REJECTED' && depositRejectionReason && (
        <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-4 py-3">
          <p className="text-[#f87171] text-sm font-semibold">
            Proof rejected — please re-upload
          </p>
          <p className="text-[#f87171] text-xs mt-1">{depositRejectionReason}</p>
        </div>
      )}

      {/* Preview of selected file */}
      {preview && (
        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10">
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
      )}

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-white/10 rounded-lg px-4 py-3 text-sm text-white/50 hover:border-[rgba(196,154,60,0.5)] hover:text-[#C49A3C] transition-colors w-full justify-center"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload deposit receipt ({depositAmount})
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {isUploading ? 'Uploading…' : 'Submit proof'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isUploading}
            className="flex-1 border border-white/10 text-white/60 hover:bg-white/5 text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-[#f87171] text-xs">{error}</p>}
    </div>
  );
}
