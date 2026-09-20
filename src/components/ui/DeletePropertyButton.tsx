'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  propertyId: string;
  propertyAddress: string;
}

export default function DeletePropertyButton({ propertyId, propertyAddress }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(`Delete "${propertyAddress}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete property');
        return;
      }
      router.push('/dashboard/landlord/properties');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition-colors"
      >
        {isDeleting ? 'Deleting…' : 'Delete Property'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
