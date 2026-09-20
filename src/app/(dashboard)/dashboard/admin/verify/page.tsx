import { redirect } from 'next/navigation';

export default function LegacyAdminVerifyPage() {
  redirect('/dashboard/admin/kyc');
}
