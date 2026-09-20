'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { NotificationBell } from './NotificationBell';
import { NotificationDropdown } from './NotificationDropdown';

export default function TopNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // ── Unified unread counts ─────────────────────────────────────────────────
  // One endpoint returns both message and notification counts, keeping the
  // polling simple and the network footprint minimal (one request per tick).
  const [unreadCounts, setUnreadCounts] = useState({
    messageCount: 0,
    notificationCount: 0,
  });
  const [notificationOpen, setNotificationOpen] = useState(false);

  const fetchUnreadCounts = useCallback(() => {
    fetch('/api/unread-counts')
      .then((r) => r.json())
      .then((data) =>
        setUnreadCounts({
          messageCount: data.messageCount || 0,
          notificationCount: data.notificationCount || 0,
        }),
      )
      .catch(() => {
        // Silent fail — next tick will retry
      });
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [session?.user, fetchUnreadCounts]);

  const role = session?.user?.role;
  const landlordLinks = [
    { href: '/dashboard/landlord', label: 'Dashboard' },
    { href: '/dashboard/landlord/properties', label: 'Properties' },
    { href: '/dashboard/landlord/tenancies', label: 'Tenancies' },
    { href: '/dashboard/landlord/payments', label: 'Payments' },
    { href: '/dashboard/landlord/messages', label: 'Messages' },
  ];

  const tenantLinks = [
    { href: '/dashboard/tenant', label: 'Dashboard' },
    { href: '/dashboard/tenant/tenancy', label: 'My Tenancy' },
    { href: '/dashboard/tenant/payments', label: 'Payments' },
    { href: '/dashboard/tenant/messages', label: 'Messages' },
  ];

  const adminLinks = [
    { href: '/dashboard/admin', label: 'Dashboard' },
    { href: '/dashboard/admin/kyc', label: 'KYC Verification' },
    { href: '/dashboard/admin/properties', label: 'Property Verification' },
  ];

  const navLinks =
    role === 'LANDLORD'
      ? landlordLinks
      : role === 'ADMIN'
        ? adminLinks
        : tenantLinks;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  if (!session?.user) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link
              href={
                role === 'LANDLORD'
                  ? '/dashboard/landlord'
                  : role === 'ADMIN'
                    ? '/dashboard/admin'
                    : '/dashboard/tenant'
              }
              className="text-xl font-bold text-blue-600 flex-shrink-0"
            >
              RentalEase
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side — messages badge, notification bell, user menu */}
          <div className="flex items-center gap-2">
            {/* Messages link with unread badge — not shown for ADMIN */}
            {role !== 'ADMIN' && <Link
              href={
                role === 'LANDLORD'
                  ? '/dashboard/landlord/messages'
                  : '/dashboard/tenant/messages'
              }
              className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label={
                unreadCounts.messageCount > 0
                  ? `Messages (${unreadCounts.messageCount} unread)`
                  : 'Messages'
              }
            >
              {/* Message envelope icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              {unreadCounts.messageCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCounts.messageCount > 9
                    ? '9+'
                    : unreadCounts.messageCount}
                </span>
              )}
            </Link>}

            {/* Notification bell — not shown for ADMIN */}
            {role !== 'ADMIN' && <div className="relative">
              <NotificationBell
                count={unreadCounts.notificationCount}
                onClick={() => setNotificationOpen((v) => !v)}
              />
              <NotificationDropdown
                open={notificationOpen}
                onClose={() => setNotificationOpen(false)}
                onCountChanged={fetchUnreadCounts}
              />
            </div>}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {session.user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900 leading-tight">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-gray-500 leading-tight capitalize">
                    {role?.toLowerCase()}
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {session.user.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {session.user.email}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Profile
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav links */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-2">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 text-sm font-medium rounded-lg mx-1 transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
