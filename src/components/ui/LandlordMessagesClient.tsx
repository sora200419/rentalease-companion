'use client';

import { useState } from 'react';
import MessageThread from './MessageThread';

const TENANCY_STATUS_LABEL: Record<string, string> = {
  INVITED: 'Invited',
  PENDING: 'Pending',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
};

interface TenancyItem {
  id: string;
  propertyAddress: string;
  propertyCity: string;
  tenantName: string;
  unreadCount: number;
  status?: string;
}

interface Props {
  tenancies: TenancyItem[];
  currentUserId: string;
}

export default function LandlordMessagesClient({
  tenancies,
  currentUserId,
}: Props) {
  // Default to the first tenancy so the landlord sees content immediately
  const [selectedId, setSelectedId] = useState<string>(tenancies[0]?.id ?? '');

  const selected = tenancies.find((t) => t.id === selectedId);

  return (
    <div className="flex gap-5 h-[calc(100vh-theme(spacing.14)-theme(spacing.12))] min-h-[480px]">
      {/* Sidebar — list of tenancy conversations */}
      <div className="w-72 shrink-0 flex flex-col bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[rgba(196,154,60,0.1)] bg-white/[0.03]">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Conversations
          </p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[rgba(255,255,255,0.06)]">
          {tenancies.map((tenancy) => (
            <button
              key={tenancy.id}
              onClick={() => setSelectedId(tenancy.id)}
              className={`w-full text-left px-4 py-3.5 transition-colors ${
                selectedId === tenancy.id
                  ? 'bg-[rgba(196,154,60,0.06)] border-r-2 border-[#C49A3C]'
                  : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {tenancy.tenantName}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {tenancy.propertyAddress}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {tenancy.propertyCity}
                  </p>
                  {tenancy.status && (
                    <span className="text-[10px] font-medium text-white/40">
                      {TENANCY_STATUS_LABEL[tenancy.status] ?? tenancy.status}
                    </span>
                  )}
                </div>
                {/* Unread badge */}
                {tenancy.unreadCount > 0 && (
                  <span className="shrink-0 bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {tenancy.unreadCount > 9 ? '9+' : tenancy.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread panel — right side */}
      <div className="flex-1 min-w-0">
        {selected ? (
          <MessageThread
            tenancyId={selected.id}
            currentUserId={currentUserId}
            otherPartyName={selected.tenantName}
            contextLabel={`${selected.propertyAddress}, ${selected.propertyCity}`}
          />
        ) : (
          <div className="h-full bg-[#1C2740] rounded-xl border border-[rgba(196,154,60,0.15)] flex items-center justify-center">
            <p className="text-white/40 text-sm">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
