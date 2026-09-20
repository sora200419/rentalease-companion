'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

// ── Inline SVG icons ────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
function CheckSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}
function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

// ── Nav link definitions ────────────────────────────────────────────────────

interface NavLink { href: string; label: string; Icon: React.FC<{ className?: string }> }

const landlordLinks: NavLink[] = [
  { href: '/dashboard/landlord',             label: 'Dashboard',   Icon: HomeIcon },
  { href: '/dashboard/landlord/properties',  label: 'Properties',  Icon: BuildingIcon },
  { href: '/dashboard/landlord/tenancies',   label: 'Tenancies',   Icon: UsersIcon },
  { href: '/dashboard/landlord/payments',    label: 'Payments',    Icon: CreditCardIcon },
  { href: '/dashboard/landlord/messages',    label: 'Messages',    Icon: MessageIcon },
];

const tenantLinks: NavLink[] = [
  { href: '/dashboard/tenant',              label: 'Dashboard',   Icon: HomeIcon },
  { href: '/dashboard/tenant/tenancy',      label: 'My Tenancy',  Icon: FileTextIcon },
  { href: '/dashboard/tenant/payments',     label: 'Payments',    Icon: CreditCardIcon },
  { href: '/dashboard/tenant/conditions',   label: 'Conditions',  Icon: CheckSquareIcon },
  { href: '/dashboard/tenant/messages',     label: 'Messages',    Icon: MessageIcon },
];

const adminLinks: NavLink[] = [
  { href: '/dashboard/admin',            label: 'Dashboard',           Icon: HomeIcon },
  { href: '/dashboard/admin/kyc',        label: 'KYC Verification',    Icon: ShieldIcon },
  { href: '/dashboard/admin/properties', label: 'Property Verification', Icon: CheckSquareIcon },
  { href: '/dashboard/admin/users',      label: 'Users',               Icon: UsersIcon },
  { href: '/dashboard/admin/audit-log',  label: 'Audit Log',           Icon: FileTextIcon },
];

// ── Sidebar inner content (shared between desktop aside and mobile drawer) ──

interface SidebarContentProps {
  onClose?: () => void;
}

export function SidebarContent({ onClose }: SidebarContentProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const role = session?.user?.role;

  const navLinks =
    role === 'LANDLORD' ? landlordLinks :
    role === 'ADMIN'    ? adminLinks    : tenantLinks;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== `/dashboard/${role?.toLowerCase()}` && pathname.startsWith(href));

  if (!session?.user) return null;

  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[rgba(196,154,60,0.15)] shrink-0">
        <span className="font-serif text-sm font-bold tracking-[0.25em] text-[#C49A3C] uppercase">
          RentalEase
        </span>
      </div>

      {/* Section label */}
      <p className="px-5 pt-5 pb-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider shrink-0">
        Navigation
      </p>

      {/* Nav links */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[rgba(196,154,60,0.12)] text-[#C49A3C] border border-[rgba(196,154,60,0.25)]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#C49A3C]' : 'text-white/30'}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — user, sign out */}
      <div className="border-t border-[rgba(196,154,60,0.15)] p-3 space-y-0.5 shrink-0">
        {/* User info — admin gets a non-clickable display, others link to profile */}
        {role === 'ADMIN' ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-[#C49A3C] flex items-center justify-center text-[#1C2740] text-xs font-semibold shrink-0">
              {session.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {session.user.name}
              </p>
              <p className="text-xs text-white/40 capitalize truncate leading-tight">
                {role?.toLowerCase()}
              </p>
            </div>
          </div>
        ) : (
          <Link
            href="/dashboard/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#C49A3C] flex items-center justify-center text-[#1C2740] text-xs font-semibold shrink-0">
              {session.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {session.user.name}
              </p>
              <p className="text-xs text-white/40 capitalize truncate leading-tight">
                {role?.toLowerCase()}
              </p>
            </div>
          </Link>
        )}

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <LogOutIcon className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );
}

// ── Desktop sidebar (fixed, always visible on lg+) ──────────────────────────

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 min-h-screen bg-[#1C2740] flex-col shrink-0 sticky top-0 h-screen overflow-y-auto z-30">
      <SidebarContent />
    </aside>
  );
}

// ── Mobile drawer ────────────────────────────────────────────────────────────

export function MobileSidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside className="relative z-50 flex w-60 h-full bg-[#1C2740] flex-col">
        <SidebarContent onClose={onClose} />
      </aside>
    </div>
  );
}

// ── Hamburger / menu toggle button (used in top header bar) ─────────────────

export function MenuToggleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg text-white/40 hover:bg-white/5 transition-colors lg:hidden"
      aria-label="Open navigation menu"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
