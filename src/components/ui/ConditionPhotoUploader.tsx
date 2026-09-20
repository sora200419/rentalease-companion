'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// Common room labels for Malaysian residential properties.
// The user can also type a custom label for unusual spaces.
const ROOM_OPTIONS = [
  'Living Room',
  'Kitchen',
  'Dining Area',
  'Master Bedroom',
  'Bedroom 2',
  'Bedroom 3',
  'Bathroom 1',
  'Bathroom 2',
  'Balcony',
  'Store Room',
  'Car Park',
  'Exterior',
];

interface Props {
  reportId: string;
}

export default function ConditionPhotoUploader({ reportId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRoom, setSelectedRoom] = useState(ROOM_OPTIONS[0]);
  const [customRoom, setCustomRoom] = useState('');
  const [useCustomRoom, setUseCustomRoom] = useState(false);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const effectiveRoom = useCustomRoom ? customRoom.trim() : selectedRoom;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!effectiveRoom) {
      setError('Please select or enter a room/area label.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('room', effectiveRoom);
      if (caption.trim()) formData.append('caption', caption.trim());

      const response = await fetch(
        `/api/condition-reports/${reportId}/photos`,
        { method: 'POST', body: formData },
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? 'Upload failed');
      }

      setCaption('');
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Upload failed. Please try again.',
      );
      setPreview(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-[#111827]/55 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <div className="mb-4">
        <p className="text-sm font-semibold text-white">Add Photos</p>
        <p className="mt-0.5 text-xs text-white/40">
          Upload room evidence for this condition report.
        </p>
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-semibold text-white/55">
          Room / Area
        </label>
        {!useCustomRoom ? (
          <div className="flex gap-2">
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="flex-1 rounded-lg border border-[rgba(196,154,60,0.18)] bg-[#0f172a] px-3 py-2 text-sm text-white shadow-inner shadow-black/10 [color-scheme:dark] focus:border-[#C49A3C] focus:outline-none focus:ring-2 focus:ring-[rgba(196,154,60,0.25)]"
            >
              {ROOM_OPTIONS.map((room) => (
                <option key={room} value={room} className="bg-[#0f172a] text-white">
                  {room}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setUseCustomRoom(true)}
              className="shrink-0 rounded-lg border border-[rgba(196,154,60,0.2)] px-3 text-xs font-semibold text-[#C49A3C] transition-colors hover:bg-[rgba(196,154,60,0.1)] hover:text-[#E8B84B]"
            >
              Custom
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={customRoom}
              onChange={(e) => setCustomRoom(e.target.value)}
              placeholder="e.g. Laundry Area, Rooftop"
              className="flex-1 rounded-lg border border-[rgba(196,154,60,0.18)] bg-[#0f172a] px-3 py-2 text-sm text-white placeholder:text-white/30 shadow-inner shadow-black/10 focus:border-[#C49A3C] focus:outline-none focus:ring-2 focus:ring-[rgba(196,154,60,0.25)]"
            />
            <button
              type="button"
              onClick={() => {
                setUseCustomRoom(false);
                setCustomRoom('');
              }}
              className="shrink-0 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
            >
              Preset
            </button>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-xs font-semibold text-white/55">
          Caption <span className="text-white/30">(optional)</span>
        </label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Scratch on wall near window"
          maxLength={500}
          className="w-full rounded-lg border border-[rgba(196,154,60,0.18)] bg-[#0f172a] px-3 py-2 text-sm text-white placeholder:text-white/30 shadow-inner shadow-black/10 focus:border-[#C49A3C] focus:outline-none focus:ring-2 focus:ring-[rgba(196,154,60,0.25)]"
        />
      </div>

      {preview && (
        <div className="relative mb-3 h-20 w-20 overflow-hidden rounded-lg border border-[rgba(196,154,60,0.35)] opacity-75">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Uploading preview"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B84B] border-t-transparent" />
          </div>
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id={`condition-upload-${reportId}`}
        />
        <label
          htmlFor={`condition-upload-${reportId}`}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
            isUploading
              ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/30'
              : 'border-[rgba(196,154,60,0.35)] bg-[rgba(196,154,60,0.08)] text-[#E8B84B] hover:border-[#C49A3C] hover:bg-[rgba(196,154,60,0.14)]'
          }`}
        >
          {isUploading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E8B84B] border-t-transparent" />
              Uploading...
            </>
          ) : (
            <>Choose Photo</>
          )}
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-[#f87171]">{error}</p>}
    </div>
  );
}
