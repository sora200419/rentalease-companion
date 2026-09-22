import { notFound } from 'next/navigation';
import RecordsWorkspace from './RecordsWorkspace';
export const dynamic = 'force-dynamic';
export default function RecordsPage() {
  if (process.env.COMPANION_RECORDS_MODE !== '1') notFound();
  return <RecordsWorkspace />;
}
