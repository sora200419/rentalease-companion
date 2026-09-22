import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';

async function handler(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const options = process.env.COMPANION_RECORDS_MODE === '1'
    ? (await import('@/lib/companion/records-auth')).recordsAuthOptions
    : (await import('@/lib/auth')).authOptions;
  return NextAuth(options)(request, context);
}

export { handler as GET, handler as POST };
