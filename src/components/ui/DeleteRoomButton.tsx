'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  roomId: string;
  roomLabel: string;
}

export default function DeleteRoomButton({ roomId, roomLabel }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(`Delete "${roomLabel}"? This cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete room');
        return;
      }
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
        className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-40 transition-colors"
      >
        {isDeleting ? 'Deleting…' : 'Delete Room'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
