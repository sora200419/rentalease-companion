'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Sidebar, { MobileSidebarDrawer, MenuToggleButton } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { NotificationDropdown } from './NotificationDropdown';
import Link from 'next/link';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({ messageCount: 0, notificationCount: 0 });

  const role = session?.user?.role;

  const fetchUnreadCounts = useCallback(() => {
    fetch('/api/unread-counts')
      .then((r) => r.json())
      .then((data) =>
        setUnreadCounts({
          messageCount: data.messageCount || 0,
          notificationCount: data.notificationCount || 0,
        }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, [session?.user, fetchUnreadCounts]);

  const messagesHref =
    role === 'LANDLORD' ? '/dashboard/landlord/messages' : '/dashboard/tenant/messages';

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile drawer */}
      <MobileSidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top header bar */}
        <header className="h-14 bg-[#1C2740] border-b border-[rgba(196,154,60,0.15)] flex items-center px-4 sm:px-6 gap-3 shrink-0 sticky top-0 z-20">
          <MenuToggleButton onClick={() => setMobileOpen(true)} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Messages link — not for ADMIN */}
          {role !== 'ADMIN' && (
            <Link
              href={messagesHref}
              className="relative p-2 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
              aria-label={
                unreadCounts.messageCount > 0
                  ? `Messages (${unreadCounts.messageCount} unread)`
                  : 'Messages'
              }
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {unreadCounts.messageCount > 0 && (
                <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-bold text-[#1C2740] bg-[#C49A3C] rounded-full border border-[#1C2740]">
                  {unreadCounts.messageCount > 9 ? '9+' : unreadCounts.messageCount}
                </span>
              )}
            </Link>
          )}

          {/* Notification bell */}
          <div className="relative">
            <NotificationBell
              count={unreadCounts.notificationCount}
              onClick={() => setNotificationOpen((v) => !v)}
            />
            <NotificationDropdown
              open={notificationOpen}
              onClose={() => setNotificationOpen(false)}
              onCountChanged={fetchUnreadCounts}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
