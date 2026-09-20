import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');

  if (session.user.role === 'LANDLORD') redirect('/dashboard/landlord');
  if (session.user.role === 'TENANT') redirect('/dashboard/tenant');
  redirect('/login');
}
