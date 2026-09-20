'use client';

import Link from 'next/link';

interface Props {
  activeTab: 'pending' | 'verified';
  pendingCount: number;
  verifiedCount: number;
}

export default function AdminTabBar({ activeTab, pendingCount, verifiedCount }: Props) {
  const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
  const active = 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740]';
  const inactive = 'text-white/60 hover:bg-white/5';

  return (
    <div className="flex gap-2 mb-6">
      <Link
        href="?tab=pending"
        className={`${base} ${activeTab === 'pending' ? active : inactive}`}
      >
        Pending ({pendingCount})
      </Link>
      <Link
        href="?tab=verified"
        className={`${base} ${activeTab === 'verified' ? active : inactive}`}
      >
        Verified ({verifiedCount})
      </Link>
    </div>
  );
}

interface AdminNavProps {
  active: 'kyc' | 'properties' | 'users' | 'audit-log';
}

export function AdminNav({ active }: AdminNavProps) {
  const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
  const activeClass = 'bg-gradient-to-br from-[#C49A3C] to-[#E8B84B] text-[#1C2740]';
  const inactiveClass = 'text-white/60 hover:bg-white/5';

  return (
    <div className="flex gap-2 mb-6">
      <a href="/dashboard/admin/kyc" className={`${base} ${active === 'kyc' ? activeClass : inactiveClass}`}>
        KYC
      </a>
      <a href="/dashboard/admin/properties" className={`${base} ${active === 'properties' ? activeClass : inactiveClass}`}>
        Properties
      </a>
      <a href="/dashboard/admin/users" className={`${base} ${active === 'users' ? activeClass : inactiveClass}`}>
        Users
      </a>
      <a href="/dashboard/admin/audit-log" className={`${base} ${active === 'audit-log' ? activeClass : inactiveClass}`}>
        Audit Log
      </a>
    </div>
  );
}
