import type { Metadata } from 'next';
import './globals.css';
import AuthSessionProvider from '@/components/providers/SessionProvider';
import { ensureAdminBootstrap } from '@/lib/admin/bootstrap';

export const metadata: Metadata = {
  title: 'RentalEase Malaysia',
  description:
    'AI-Assisted Digital Tenancy Agreement Platform for Malaysian Residential Rentals',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const skipBootstrap =
    process.env.COMPANION_OFFLINE_DEMO === '1' ||
    process.env.PRISMA_GENERATE_NO_ENGINE === '1' ||
    process.env.NEXT_PHASE === 'phase-production-build';

  if (!skipBootstrap) {
    try {
      await ensureAdminBootstrap();
    } catch (error) {
      console.error('[admin-bootstrap] Automatic bootstrap failed:', error);
    }
  }

  return (
    <html lang="en">
      <body>
        {process.env.COMPANION_OFFLINE_DEMO === '1' ? children : <AuthSessionProvider>{children}</AuthSessionProvider>}
      </body>
    </html>
  );
}
