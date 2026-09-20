// src/components/ui/NotificationBell.tsx
'use client';

interface NotificationBellProps {
  count: number;
  onClick: () => void;
}

/*
 * The notification bell icon with a count badge.
 *
 * Why this component is separate from the dropdown
 * ------------------------------------------------
 * The bell and the dropdown are visually attached but architecturally
 * independent. The bell only needs to know the unread count (which comes
 * from TopNav's polling state) and what to do when clicked. The dropdown
 * manages its own fetch state and only mounts when actually opened.
 *
 * Keeping them separate means the bell can re-render on every count
 * change (every 30 seconds when polling returns a new value) without
 * causing the dropdown to re-render. This is a small optimization but
 * the separation also makes the code easier to read and test.
 *
 * The 9+ cap explained
 * --------------------
 * When the count exceeds 9 we show "9+" instead of the literal number.
 * Two reasons: first, a three-digit number (like 123) would make the
 * badge wider than the icon and look awkward. Second, users don't really
 * care about the exact count once it is "many" — "9+" communicates
 * "you have a lot to catch up on" which is all that matters at a glance.
 */
export function NotificationBell({ count, onClick }: NotificationBellProps) {
  const displayCount = count > 9 ? '9+' : String(count);

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      aria-label={
        count > 0 ? `Notifications (${count} unread)` : 'Notifications'
      }
    >
      {/* Inline SVG rather than an icon library import — avoids adding a
          new dependency just for one icon and keeps the bundle tiny. */}
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
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge — only rendered when there is at least one unread notification.
          Positioned absolutely so it floats over the top-right corner of the
          bell. Using fixed min-width lets single-digit and "9+" both fit. */}
      {count > 0 && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
          {displayCount}
        </span>
      )}
    </button>
  );
}
