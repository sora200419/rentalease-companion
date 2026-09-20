'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Photo = {
  id: string;
  imageUrl: string;
  caption: string | null;
};

export default function PropertyPhotoGallery({
  propertyId,
  photos: initialPhotos,
}: {
  propertyId: string;
  photos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(photoId: string) {
    setDeleting(photoId);
    try {
      const res = await fetch(
        `/api/properties/${propertyId}/photos?photoId=${photoId}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  if (photos.length === 0) {
    return (
      <p className="text-sm text-white/40 text-center py-4">
        No photos yet. Upload some to showcase this property.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {photos.map((photo) => (
        <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-[rgba(196,154,60,0.15)]">
          <Image
            src={photo.imageUrl}
            alt={photo.caption ?? 'Property photo'}
            width={400}
            height={250}
            className="w-full h-36 object-cover"
          />
          {photo.caption && (
            <p className="text-xs text-white/60 px-2 py-1 bg-[#1C2740] truncate">
              {photo.caption}
            </p>
          )}
          <button
            onClick={() => handleDelete(photo.id)}
            disabled={deleting === photo.id}
            className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete photo"
          >
            {deleting === photo.id ? '…' : '×'}
          </button>
        </div>
      ))}
    </div>
  );
}
