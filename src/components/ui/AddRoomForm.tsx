'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Descriptive labels for each room type so landlords understand
// what they're selecting without needing to know the enum name
const ROOM_TYPE_OPTIONS = [
  {
    value: 'ENTIRE_UNIT',
    label: 'Entire Unit',
    desc: 'Whole apartment or house let as one',
  },
  {
    value: 'MASTER',
    label: 'Master Room',
    desc: 'Largest room, typically with attached bathroom',
  },
  {
    value: 'MEDIUM',
    label: 'Medium Room',
    desc: 'Mid-size room, typically sharing bathroom',
  },
  { value: 'SMALL', label: 'Small / Single Room', desc: 'Smallest room type' },
  {
    value: 'STUDIO',
    label: 'Studio',
    desc: 'Self-contained unit with own kitchen area',
  },
];

const FURNISHING_OPTIONS = [
  {
    value: 'FULLY_FURNISHED',
    label: 'Fully Furnished',
    desc: 'Bed, wardrobe, AC, desk — move-in ready',
  },
  {
    value: 'PARTIALLY_FURNISHED',
    label: 'Partially Furnished',
    desc: 'Some items provided (wardrobe, fan/AC)',
  },
  {
    value: 'UNFURNISHED',
    label: 'Unfurnished',
    desc: 'Empty room — tenant brings own furniture',
  },
];

const GENDER_OPTIONS = [
  { value: 'ANY', label: 'Any gender' },
  { value: 'FEMALE_ONLY', label: 'Female only' },
  { value: 'MALE_ONLY', label: 'Male only' },
];

// Small reusable label + input wrapper — keeps JSX clean
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-white/70 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}

export default function AddRoomForm({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [label, setLabel] = useState('');
  const [roomType, setRoomType] = useState('ENTIRE_UNIT');
  const [bathroomType, setBathroomType] = useState('SHARED');
  const [bathrooms, setBathrooms] = useState('1');
  const [rentAmount, setRentAmount] = useState('');
  const [furnishing, setFurnishing] = useState('PARTIALLY_FURNISHED');
  const [maxOccupants, setMaxOccupants] = useState('1');
  const [sizeSqFt, setSizeSqFt] = useState('');
  const [floorLevel, setFloorLevel] = useState('');
  const [wifiIncluded, setWifiIncluded] = useState(false);
  const [waterIncluded, setWaterIncluded] = useState(false);
  const [electricIncluded, setElectricIncluded] = useState(false);
  const [genderPreference, setGenderPreference] = useState('ANY');
  const [notes, setNotes] = useState('');

  // When room type changes, auto-set sensible defaults for bathroom type.
  // Master rooms in Malaysia are almost always attached; others are shared.
  const handleRoomTypeChange = (value: string) => {
    setRoomType(value);
    if (value === 'MASTER' || value === 'ENTIRE_UNIT' || value === 'STUDIO') {
      setBathroomType('ATTACHED');
    } else {
      setBathroomType('SHARED');
    }
    // Auto-populate a sensible label if the user hasn't typed one yet
    if (!label) {
      const option = ROOM_TYPE_OPTIONS.find((o) => o.value === value);
      if (option) setLabel(option.label);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          label: label.trim(),
          roomType,
          bathroomType,
          bathrooms: Number(bathrooms),
          rentAmount: Number(rentAmount),
          furnishing,
          maxOccupants: Number(maxOccupants),
          sizeSqFt: sizeSqFt ? Number(sizeSqFt) : null,
          floorLevel: floorLevel ? Number(floorLevel) : null,
          wifiIncluded,
          waterIncluded,
          electricIncluded,
          genderPreference,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create room');
        return;
      }

      // Reset all fields
      setLabel('');
      setRoomType('ENTIRE_UNIT');
      setBathroomType('SHARED');
      setBathrooms('1');
      setRentAmount('');
      setFurnishing('PARTIALLY_FURNISHED');
      setMaxOccupants('1');
      setSizeSqFt('');
      setFloorLevel('');
      setWifiIncluded(false);
      setWaterIncluded(false);
      setElectricIncluded(false);
      setGenderPreference('ANY');
      setNotes('');
      setOpen(false);
      router.refresh(); // re-run server component to show the new room card
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';
  const selectClass =
    'w-full rounded-lg border border-white/10 bg-[#1C2740] px-4 py-2.5 text-sm text-white focus:border-[rgba(196,154,60,0.5)] focus:outline-none focus:ring-0 transition-colors';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-white/10 hover:border-[rgba(196,154,60,0.5)] hover:bg-[rgba(196,154,60,0.06)] text-white/40 hover:text-[#C49A3C] text-sm font-medium py-4 rounded-xl transition-colors"
      >
        + Add Room
      </button>
    );
  }

  return (
    <div className="border border-[rgba(196,154,60,0.2)] bg-[rgba(196,154,60,0.06)] rounded-xl p-6">
      <h3 className="text-sm font-bold text-[#C49A3C] mb-5">Add New Room</h3>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Section 1: Room identity ─────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Room Identity
          </p>
          <div className="space-y-4">
            <Field label="Room Type *">
              <div className="grid grid-cols-1 gap-2">
                {ROOM_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      roomType === opt.value
                        ? 'border-[rgba(196,154,60,0.5)] bg-white/5'
                        : 'border-[rgba(196,154,60,0.15)] bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <input
                      type="radio"
                      name="roomType"
                      value={opt.value}
                      checked={roomType === opt.value}
                      onChange={() => handleRoomTypeChange(opt.value)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {opt.label}
                      </p>
                      <p className="text-xs text-white/40">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <Field
              label="Display Label *"
              hint='A specific name for this room, e.g. "Master Room (Level 2)" or "Room A"'
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Master Room, Room A, Entire Unit"
                className={inputClass}
                required
              />
            </Field>
          </div>
        </div>

        {/* ── Section 2: Bathroom ──────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Bathroom
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Attached bathroom option */}
            <label
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                bathroomType === 'ATTACHED'
                  ? 'border-[rgba(196,154,60,0.5)] bg-white/5'
                  : 'border-[rgba(196,154,60,0.15)] bg-white/5 hover:border-white/10'
              }`}
            >
              <input
                type="radio"
                name="bathroomType"
                value="ATTACHED"
                checked={bathroomType === 'ATTACHED'}
                onChange={() => setBathroomType('ATTACHED')}
                className="accent-blue-600"
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  Attached
                </p>
                <p className="text-xs text-white/40">
                  Private bathroom inside the room
                </p>
              </div>
            </label>

            {/* Shared bathroom option */}
            <label
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                bathroomType === 'SHARED'
                  ? 'border-[rgba(196,154,60,0.5)] bg-white/5'
                  : 'border-[rgba(196,154,60,0.15)] bg-white/5 hover:border-white/10'
              }`}
            >
              <input
                type="radio"
                name="bathroomType"
                value="SHARED"
                checked={bathroomType === 'SHARED'}
                onChange={() => setBathroomType('SHARED')}
                className="accent-blue-600"
              />
              <div>
                <p className="text-sm font-semibold text-white">Shared</p>
                <p className="text-xs text-white/40">
                  Common bathroom shared with others
                </p>
              </div>
            </label>
          </div>

          <Field
            label="Number of Bathrooms"
            hint="For attached: 1 (the private one). For shared: how many tenants share each bathroom."
          >
            <input
              type="number"
              min={1}
              max={10}
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        {/* ── Section 3: Pricing ───────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Pricing
          </p>
          <Field label="Monthly Rent (RM) *">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 800"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        {/* ── Section 4: Furnishing ────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Furnishing Level
          </p>
          <div className="space-y-2">
            {FURNISHING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  furnishing === opt.value
                    ? 'border-[rgba(196,154,60,0.5)] bg-white/5'
                    : 'border-[rgba(196,154,60,0.15)] bg-white/5 hover:border-white/10'
                }`}
              >
                <input
                  type="radio"
                  name="furnishing"
                  value={opt.value}
                  checked={furnishing === opt.value}
                  onChange={() => setFurnishing(opt.value)}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {opt.label}
                  </p>
                  <p className="text-xs text-white/40">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Section 5: Included utilities ────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Utilities Included in Rent
          </p>
          <p className="text-xs text-white/40 mb-3">
            Tick what is covered by the monthly rent — these will appear in the
            tenancy agreement.
          </p>
          <div className="space-y-2">
            {[
              {
                key: 'wifi',
                label: 'WiFi / Internet',
                value: wifiIncluded,
                setter: setWifiIncluded,
              },
              {
                key: 'water',
                label: 'Water',
                value: waterIncluded,
                setter: setWaterIncluded,
              },
              {
                key: 'electric',
                label: 'Electricity',
                value: electricIncluded,
                setter: setElectricIncluded,
              },
            ].map((util) => (
              <label
                key={util.key}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-[rgba(196,154,60,0.15)] cursor-pointer hover:border-white/10"
              >
                <input
                  type="checkbox"
                  checked={util.value}
                  onChange={(e) => util.setter(e.target.checked)}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-sm font-medium text-white/70">
                  {util.label}
                </span>
                <span className="text-xs text-white/40 ml-auto">
                  {util.value ? 'Included' : 'Tenant pays separately'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Section 6: Room preferences ─────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Room Preferences
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Max Occupants"
              hint="How many people can stay in this room"
            >
              <input
                type="number"
                min={1}
                max={10}
                value={maxOccupants}
                onChange={(e) => setMaxOccupants(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Gender Preference">
              <select
                value={genderPreference}
                onChange={(e) => setGenderPreference(e.target.value)}
                className={selectClass}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* ── Section 7: Optional details ──────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Optional Details
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Room Size (sq ft)" hint="e.g. 200">
              <input
                type="number"
                min={1}
                value={sizeSqFt}
                onChange={(e) => setSizeSqFt(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </Field>
            <Field label="Floor Level" hint="e.g. 1 for ground floor">
              <input
                type="number"
                min={1}
                value={floorLevel}
                onChange={(e) => setFloorLevel(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label="Additional Notes"
            hint="Anything else a tenant should know — window orientation, storage space, etc."
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Corner unit with lots of natural light, built-in wardrobe included"
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        {error && (
          <p className="text-[#f87171] text-xs bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.25)] rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="flex-1 text-sm font-medium text-white/50 hover:text-white/70 border border-white/10 bg-white/5 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 text-sm font-semibold text-[#1C2740] bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] hover:opacity-90 disabled:opacity-50 py-2 rounded-lg transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
