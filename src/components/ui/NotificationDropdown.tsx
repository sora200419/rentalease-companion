// src/components/ui/NotificationDropdown.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationType } from '@prisma/client';

/*
 * Type definition for a notification as it comes from the API. We don't
 * import the Prisma type directly because the Date fields come back as
 * ISO strings over the wire, not Date objects.
 */
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationDropdownProps {
  open: boolean;
  onClose: () => void;
  /*
   * Called after any mark-read action so the parent (TopNav) can refresh
   * its unread count badge. The parent will typically trigger a new fetch
   * of /api/unread-counts in response.
   */
  onCountChanged: () => void;
}

function NotificationIcon() {
  return (
    <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

/*
 * Format an ISO timestamp as a relative time string like "5m ago" or
 * "2h ago". For notifications older than a week, fall back to an
 * absolute date. This is lighter-weight than importing a library like
 * date-fns just for one helper.
 */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationDropdown({
  open,
  onClose,
  onCountChanged,
}: NotificationDropdownProps) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /*
   * Fetch notifications whenever the dropdown is opened.
   *
   * We refetch on every open rather than caching, because the count badge
   * the user clicked is based on a polling snapshot that might be up to
   * 30 seconds stale. Refetching on open guarantees the list matches
   * what the badge promised.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch('/api/notifications?limit=20');
        const data = await r.json();
        if (!cancelled) setItems(data.items || []);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /*
   * Close the dropdown when clicking anywhere outside it.
   *
   * The setTimeout(..., 0) is a subtle but important detail. Without it,
   * the same click that OPENED the dropdown would be caught by this
   * handler as an "outside click" and immediately close it. Deferring
   * the listener attachment by one tick means the opening click finishes
   * propagating before we start listening for future clicks.
   */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const timeout = setTimeout(
      () => document.addEventListener('mousedown', handler),
      0,
    );
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  /*
   * Close on Escape key press. This is a basic keyboard accessibility
   * feature that users familiar with modals and dropdowns expect.
   */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /*
   * Handle a click on an individual notification.
   *
   * Optimistic UI update: we mark the notification as read in local state
   * IMMEDIATELY, without waiting for the API response. This makes the click
   * feel instant. If the API call fails, the UI is slightly out of sync
   * until the next fetch, but that is a much better user experience than
   * a click that feels laggy because we waited for the network.
   *
   * If the notification has a link, we close the dropdown and navigate.
   * If not, we just mark read and leave the dropdown open.
   */
  const handleItemClick = (n: Notification) => {
    if (!n.readAt) {
      // Optimistic local update
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x,
        ),
      );
      // Fire and forget the API call — the onCountChanged callback refreshes
      // the badge in TopNav when it succeeds.
      fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
        .then(() => onCountChanged())
        .catch((err) => console.error('Failed to mark read:', err));
    }

    if (n.link) {
      onClose();
      router.push(n.link);
    }
  };

  /*
   * Handle the "Mark all read" button. Same optimistic pattern — update
   * local state immediately, then send the API request in the background.
   */
  const handleMarkAllRead = async () => {
    setItems((prev) =>
      prev.map((x) => ({
        ...x,
        readAt: x.readAt ?? new Date().toISOString(),
      })),
    );
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
      onCountChanged();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  if (!open) return null;

  const hasUnread = items.some((x) => !x.readAt);

  return (
    <>
      {/*
        Mobile backdrop: a translucent overlay that covers the whole screen
        behind the dropdown. This visually separates the dropdown from the
        page content and gives the user a clear target for "tap outside to
        close" on touch devices. Hidden on desktop (sm: breakpoint) where
        the dropdown is a positional popover rather than a modal.
      */}
      <div
        className="sm:hidden fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/*
        Dropdown container. The className string looks busy because of the
        responsive variants — let me explain the intent:

        Desktop (sm: and up):
          - position: absolute, anchored below and to the right of the bell
          - width: 24rem (w-96)
          - max-height: 80% of viewport height
          - rounded corners on all sides

        Mobile (below sm:):
          - position: fixed, anchored to the bottom of the screen
          - full width (inset-x-0 means left:0 right:0)
          - max-height: 70% of viewport height
          - rounded corners only on top (bottom sits flush with screen)

        The flex flex-col + overflow-y-auto on the body gives us a header
        that stays fixed while the notification list scrolls independently.
      */}
      <div
        ref={containerRef}
        className="
          fixed sm:absolute
          inset-x-0 bottom-0 sm:inset-auto sm:right-0 sm:top-full sm:mt-2
          sm:w-96
          max-h-[70vh] sm:max-h-[80vh]
          bg-[#1C2740] rounded-t-xl sm:rounded-xl
          shadow-xl border border-[rgba(196,154,60,0.15)]
          flex flex-col
          z-50
        "
      >
        {/* Header with title and actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(196,154,60,0.1)] flex-shrink-0">
          <h3 className="font-semibold text-white">Notifications</h3>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#C49A3C] hover:opacity-90 font-medium"
              >
                Mark all read
              </button>
            )}
            {/* Close button only on mobile — desktop has outside-click */}
            <button
              onClick={onClose}
              className="sm:hidden text-white/40 hover:text-white/60 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable list body */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 && (
            <div className="p-8 text-center text-sm text-white/40">
              Loading…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-8 text-center text-sm text-white/40">
              No notifications yet.
              <br />
              <span className="text-xs">
                You&apos;ll see updates about invitations, agreements, and
                payments here.
              </span>
            </div>
          )}

          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`
                w-full text-left px-4 py-3 border-b border-[rgba(255,255,255,0.06)] last:border-b-0
                hover:bg-white/5 transition-colors
                ${!n.readAt ? 'bg-[rgba(196,154,60,0.06)]' : ''}
              `}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <NotificationIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${
                        !n.readAt
                          ? 'font-semibold text-white'
                          : 'text-white/70'
                      }`}
                    >
                      {n.title}
                    </p>
                    {/* Gold dot indicator for unread items */}
                    {!n.readAt && (
                      <span className="flex-shrink-0 w-2 h-2 bg-[#C49A3C] rounded-full mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
