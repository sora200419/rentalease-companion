import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Home() {
  // The local demo modes have no inherited login backend; send judges to the guide.
  if (process.env.COMPANION_OFFLINE_DEMO === '1' || process.env.COMPANION_RECORDS_MODE === '1') redirect('/guide');
  redirect('/login');
}
