import { notFound } from 'next/navigation';
import JudgeDemo from './JudgeDemo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Independent demo · RentalEase' };
export default function Page() {
  if (process.env.COMPANION_OFFLINE_DEMO !== '1' || process.env.COMPANION_RECORDS_MODE === '1') notFound();
  return <JudgeDemo />;
}
