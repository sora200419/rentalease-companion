import Image from 'next/image';
import { getPropertyCoverAlt } from '@/lib/uiRedesign';

type PropertyCoverProps = {
  address: string;
  imageUrl?: string | null;
  caption?: string | null;
  className?: string;
  heightClassName?: string;
  fallbackLabel?: string;
};

export default function PropertyCover({
  address,
  imageUrl,
  caption,
  className = '',
  heightClassName = 'h-40',
  fallbackLabel = 'No photo yet',
}: PropertyCoverProps) {
  const baseClass = `relative overflow-hidden bg-white/5 ${heightClassName} ${className}`;

  if (!imageUrl) {
    return (
      <div className={`${baseClass} flex items-center justify-center border border-dashed border-white/10`}>
        <div className="text-center px-4">
          <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#1C2740] text-white/40 ring-1 ring-[rgba(196,154,60,0.15)]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2 1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-xs font-semibold text-white/50">{fallbackLabel}</p>
          <p className="mt-0.5 text-[11px] text-white/40">Add photos to improve recognition</p>
        </div>
      </div>
    );
  }

  return (
    <div className={baseClass}>
      <Image
        src={imageUrl}
        alt={getPropertyCoverAlt(address, caption)}
        fill
        sizes="(max-width: 768px) 100vw, 360px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 py-3">
        <p className="text-xs font-semibold text-white drop-shadow">{caption ?? address}</p>
      </div>
    </div>
  );
}
