'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/*
 * Generic error boundary for the application. Next.js automatically uses
 * `src/app/error.tsx` as the catch-all for errors thrown during rendering
 * of any page or server component. It must be a client component because
 * the `reset` function it receives is a client-side callback that clears
 * the error state and re-renders the failed segment.
 *
 * The `error.digest` field is an anonymized hash of the underlying error
 * that Next.js generates for server-side errors. Showing this to the user
 * lets them reference it in a support request without exposing the raw
 * error message, which might contain sensitive details like stack traces.
 *
 * The original error is also logged to the browser console. In production
 * this would normally be replaced by a call to an error-tracking service
 * like Sentry, but for an FYP context the console is sufficient.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the full error object to the console on mount so we have the stack
  // trace available for debugging even though the user only sees the digest.
  useEffect(() => {
    console.error('Page error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-xl shadow-md p-10">
        {/* Using an emoji rather than a large error code because generic 500
            errors are less commonly recognized by that number than 404 is. */}
        <svg className="w-14 h-14 text-amber-400 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred while loading this page. You can try
          again, or return to your dashboard.
        </p>

        {/* Show the digest to the user only if one exists. Development-mode
            errors often don't have a digest since Next.js only generates
            them for certain classes of server errors. */}
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6 break-all">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex gap-3">
          {/* `reset` attempts to re-render the failed segment without a
              full page reload. This usually resolves transient issues like
              a network hiccup during data fetching. */}
          <button
            onClick={() => reset()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
