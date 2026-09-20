import Link from 'next/link';

/*
 * Custom 404 page shown whenever a user navigates to a URL that does not
 * match any route in the app. Next.js automatically uses this file by
 * looking for `src/app/not-found.tsx` at the root of the app directory.
 *
 * Kept as a server component because there is no interactive state here,
 * just static content and a link back to the dashboard. That gives us the
 * smallest possible JavaScript bundle for an error page that should be
 * rare in normal usage.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-xl shadow-md p-10">
        {/* The large "404" acts as the visual anchor so the user immediately
            recognizes what kind of page this is without reading any text. */}
        <p className="text-6xl font-bold text-blue-600 mb-2">404</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Page not found
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Check the URL or head back to your dashboard.
        </p>
        {/* Linking to /dashboard is safer than / because the root redirects
            to /login, which would be confusing for a user already signed in. */}
        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
