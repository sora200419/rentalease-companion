'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CoTenant {
  id: string;
  name: string;
  icNumber: string | null;
  phone: string | null;
}

interface Props {
  tenancyId: string;
  initialCoTenants: CoTenant[];
  readonly?: boolean;
}

export default function CoTenantManager({ tenancyId, initialCoTenants, readonly = false }: Props) {
  const router = useRouter();
  const [coTenants, setCoTenants] = useState<CoTenant[]>(initialCoTenants);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/co-tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          icNumber: icNumber.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add co-tenant.');
        return;
      }
      setCoTenants((prev) => [...prev, data]);
      setName('');
      setIcNumber('');
      setPhone('');
      setShowForm(false);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (coTenantId: string) => {
    setRemovingId(coTenantId);
    try {
      const res = await fetch(`/api/tenancies/${tenancyId}/co-tenants/${coTenantId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCoTenants((prev) => prev.filter((c) => c.id !== coTenantId));
        router.refresh();
      }
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Additional Occupants</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Co-occupants listed in the agreement but not holding a system account.
          </p>
        </div>
        {!readonly && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-[#C49A3C] hover:opacity-80 border border-[rgba(196,154,60,0.2)] hover:border-[rgba(196,154,60,0.4)] px-3 py-1.5 rounded-lg transition-colors"
          >
            + Add Occupant
          </button>
        )}
      </div>

      {coTenants.length === 0 && !showForm && (
        <p className="text-xs text-white/40 italic">
          {readonly ? 'No additional occupants listed.' : 'No additional occupants yet.'}
        </p>
      )}

      {coTenants.length > 0 && (
        <div className="space-y-2 mb-3">
          {coTenants.map((ct) => (
            <div
              key={ct.id}
              className="flex items-center justify-between bg-white/[0.03] border border-[rgba(196,154,60,0.1)] rounded-lg px-4 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-white">{ct.name}</p>
                <p className="text-xs text-white/40">
                  IC: {ct.icNumber ?? 'Not provided'}
                  {ct.phone ? ` · ${ct.phone}` : ''}
                </p>
              </div>
              {!readonly && (
                <button
                  onClick={() => handleRemove(ct.id)}
                  disabled={removingId === ct.id}
                  className="text-xs text-[#f87171] hover:opacity-80 disabled:opacity-50 ml-3"
                >
                  {removingId === ct.id ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border border-[rgba(196,154,60,0.2)] rounded-lg p-4 bg-[rgba(196,154,60,0.06)] space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Full Name <span className="text-[#f87171]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ahmad bin Ali"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                IC Number <span className="text-white/40">(optional)</span>
              </label>
              <input
                type="text"
                value={icNumber}
                onChange={(e) => setIcNumber(e.target.value)}
                placeholder="e.g. 900101-14-1234"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Phone <span className="text-white/40">(optional)</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 012-3456789"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors"
              />
            </div>
          </div>
          {error && <p className="text-[#f87171] text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="flex-1 border border-white/10 text-white/60 text-sm font-medium py-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={adding || !name.trim()}
              className="flex-1 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 text-[#1C2740] text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {adding ? 'Adding…' : 'Add Occupant'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
