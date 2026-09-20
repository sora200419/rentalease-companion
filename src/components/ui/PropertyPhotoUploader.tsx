'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function PropertyPhotoUploader({
  propertyId,
}: {
  propertyId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please select a photo first.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (caption.trim()) formData.append('caption', caption.trim());

    try {
      const res = await fetch(`/api/properties/${propertyId}/photos`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      setPreview(null);
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-white/10 rounded-lg p-4 text-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          id="property-photo-input"
          onChange={handleFileChange}
        />
        <label htmlFor="property-photo-input" className="cursor-pointer block">
          {preview ? (
            <Image
              src={preview}
              alt="Preview"
              width={400}
              height={200}
              className="w-full h-48 object-cover rounded-lg"
            />
          ) : (
            <div className="py-6">
              <svg className="w-8 h-8 text-white/30 mb-1 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-white/50">Click to select a photo</p>
              <p className="text-xs text-white/40 mt-0.5">
                JPEG, PNG or WebP · max 10 MB
              </p>
            </div>
          )}
        </label>
      </div>

      {preview && (
        <input
          type="text"
          placeholder="Caption (optional, e.g. Living Room)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
        />
      )}

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!preview || uploading}
        className="w-full bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:bg-white/10 disabled:text-white/40 text-[#1C2740] text-sm font-semibold py-2.5 rounded-lg transition-colors"
      >
        {uploading ? 'Uploading...' : 'Upload Photo'}
      </button>
    </div>
  );
}
