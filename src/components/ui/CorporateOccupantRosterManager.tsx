'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Occupant = {
  id: string;
  name: string;
  icNumber: string | null;
  phone: string | null;
  roleLabel: string | null;
  status: 'UNLINKED' | 'LINKED' | 'REPLACED' | 'REMOVED';
  linkedUser: { id: string; name: string; email: string } | null;
};

type Draft = {
  name: string;
  icNumber: string;
  phone: string;
  roleLabel: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  icNumber: '',
  phone: '',
  roleLabel: '',
};

export default function CorporateOccupantRosterManager({
  tenancyId,
  initialOccupants,
  canManage,
}: {
  tenancyId: string;
  initialOccupants: Occupant[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [occupants, setOccupants] = useState<Occupant[]>(initialOccupants);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft>(EMPTY_DRAFT);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleOccupants = useMemo(
    () => occupants.filter((occupant) => occupant.status !== 'REMOVED'),
    [occupants],
  );

  const resetDraft = () => setDraft(EMPTY_DRAFT);

  const handleCreate = async () => {
    if (!draft.name.trim()) return;
    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/tenancies/${tenancyId}/corporate-occupants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to add occupant.');
        return;
      }

      setOccupants((current) => [...current, result]);
      resetDraft();
      setShowAddForm(false);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (occupant: Occupant) => {
    setEditingId(occupant.id);
    setEditingDraft({
      name: occupant.name,
      icNumber: occupant.icNumber ?? '',
      phone: occupant.phone ?? '',
      roleLabel: occupant.roleLabel ?? '',
    });
    setError(null);
  };

  const handleReplace = async (occupantId: string) => {
    if (!editingDraft.name.trim()) return;
    setBusyId(occupantId);
    setError(null);

    try {
      const response = await fetch(
        `/api/tenancies/${tenancyId}/corporate-occupants/${occupantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingDraft),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to replace occupant.');
        return;
      }

      setOccupants((current) =>
        current.map((occupant) =>
          occupant.id === occupantId ? result : occupant,
        ),
      );
      setEditingId(null);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (occupantId: string) => {
    setBusyId(occupantId);
    setError(null);

    try {
      const response = await fetch(
        `/api/tenancies/${tenancyId}/corporate-occupants/${occupantId}`,
        {
          method: 'DELETE',
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to remove occupant.');
        return;
      }

      setOccupants((current) =>
        current.map((occupant) =>
          occupant.id === occupantId ? result : occupant,
        ),
      );
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleLink = async (occupantId: string) => {
    if (!linkEmail.trim()) return;
    setBusyId(occupantId);
    setError(null);

    try {
      const response = await fetch(
        `/api/tenancies/${tenancyId}/corporate-occupants/${occupantId}/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: linkEmail }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to link occupant.');
        return;
      }

      setOccupants((current) =>
        current.map((occupant) =>
          occupant.id === occupantId ? result : occupant,
        ),
      );
      setLinkingId(null);
      setLinkEmail('');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Shared input class for roster form fields
  const inputCls = 'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Corporate Occupant Roster
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            Staff occupants can be listed first and linked to tenant accounts
            later. Only the landlord and authorized signatory should manage this
            roster.
          </p>
        </div>
        {canManage && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-xs font-semibold text-[#C49A3C] hover:opacity-80 border border-[rgba(196,154,60,0.2)] hover:border-[rgba(196,154,60,0.4)] px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add Occupant
          </button>
        )}
      </div>

      {visibleOccupants.length === 0 && !showAddForm && (
        <p className="text-xs text-white/40 italic">
          No corporate occupants listed yet.
        </p>
      )}

      <div className="space-y-3">
        {visibleOccupants.map((occupant) => {
          const isEditing = editingId === occupant.id;
          const isLinking = linkingId === occupant.id;
          const isBusy = busyId === occupant.id;

          return (
            <div
              key={occupant.id}
              className="rounded-xl border border-[rgba(196,154,60,0.15)] bg-white/[0.03] px-4 py-4"
            >
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingDraft.name}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Occupant full name"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={editingDraft.roleLabel}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          roleLabel: event.target.value,
                        }))
                      }
                      placeholder="Role label"
                      className={inputCls}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingDraft.icNumber}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          icNumber: event.target.value,
                        }))
                      }
                      placeholder="IC / passport number"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={editingDraft.phone}
                      onChange={(event) =>
                        setEditingDraft((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      placeholder="Phone number"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setError(null);
                      }}
                      className="flex-1 border border-white/10 text-white/60 text-sm font-medium py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReplace(occupant.id)}
                      disabled={isBusy || !editingDraft.name.trim()}
                      className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      {isBusy ? 'Saving...' : 'Save Replacement'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {occupant.name}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {occupant.roleLabel || 'No role label'}
                        {occupant.icNumber
                          ? ` · IC: ${occupant.icNumber}`
                          : ''}
                        {occupant.phone ? ` · ${occupant.phone}` : ''}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        occupant.status === 'LINKED'
                          ? 'bg-[rgba(74,222,128,0.1)] text-[#4ade80] ring-1 ring-[rgba(74,222,128,0.25)] ring-inset'
                          : 'bg-[rgba(251,191,36,0.08)] text-[#E8B84B] ring-1 ring-[rgba(251,191,36,0.25)] ring-inset'
                      }`}
                    >
                      {occupant.status === 'LINKED' ? 'Linked' : 'Unlinked'}
                    </span>
                  </div>

                  {occupant.linkedUser ? (
                    <p className="text-xs text-[#4ade80] mt-3">
                      Linked to {occupant.linkedUser.name} (
                      {occupant.linkedUser.email})
                    </p>
                  ) : (
                    <p className="text-xs text-white/50 mt-3">
                      No tenant account linked yet.
                    </p>
                  )}

                  {canManage && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => startEditing(occupant)}
                        className="text-xs font-medium text-[#C49A3C] hover:opacity-80"
                      >
                        Replace / Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLinkingId((current) =>
                            current === occupant.id ? null : occupant.id,
                          )
                        }
                        className="text-xs font-medium text-[#C49A3C] hover:opacity-80"
                      >
                        {occupant.linkedUser ? 'Relink Account' : 'Link Account'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(occupant.id)}
                        disabled={isBusy}
                        className="text-xs font-medium text-[#f87171] hover:opacity-80 disabled:opacity-50"
                      >
                        {isBusy ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )}

                  {isLinking && canManage && (
                    <div className="mt-4 rounded-lg border border-[rgba(196,154,60,0.2)] bg-[rgba(196,154,60,0.06)] p-3">
                      <label className="block text-xs font-medium text-white/70 mb-1">
                        Link to registered tenant email
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={linkEmail}
                          onChange={(event) => setLinkEmail(event.target.value)}
                          placeholder="tenant@example.com"
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleLink(occupant.id)}
                          disabled={isBusy || !linkEmail.trim()}
                          className="rounded-lg bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] px-4 py-2 text-sm font-semibold text-[#1C2740] hover:opacity-90 disabled:opacity-50"
                        >
                          {isBusy ? 'Linking...' : 'Link'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm && canManage && (
        <div className="border border-[rgba(196,154,60,0.2)] rounded-lg p-4 bg-[rgba(196,154,60,0.06)] space-y-3 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Occupant full name"
              className={inputCls}
            />
            <input
              type="text"
              value={draft.roleLabel}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  roleLabel: event.target.value,
                }))
              }
              placeholder="Role label"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={draft.icNumber}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  icNumber: event.target.value,
                }))
              }
              placeholder="IC / passport number"
              className={inputCls}
            />
            <input
              type="text"
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="Phone number"
              className={inputCls}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                resetDraft();
                setError(null);
              }}
              className="flex-1 border border-white/10 text-white/60 text-sm font-medium py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isAdding || !draft.name.trim()}
              className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {isAdding ? 'Adding...' : 'Add Occupant'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[#f87171] text-xs mt-3">{error}</p>}
    </div>
  );
}
