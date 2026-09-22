import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { recordsDb } from './records-client';

// Loopback, single-process development limiter. Not suitable for a distributed deployment.
const attempts = new Map<string, { count: number; until: number }>();
export const recordsAuthOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 3600 },
  pages: { signIn: '/records' },
  logger: { error: () => console.error('Records authentication failed.'), warn: () => {}, debug: () => {} },
  providers: [CredentialsProvider({ name: 'RentalEase records', credentials: { email: { type: 'email' }, password: { type: 'password' } },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password || credentials.email.length > 254 || credentials.password.length > 200) return null;
      const email = credentials.email.trim().toLowerCase();
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
      if (!attempts.has(email) && attempts.size >= 1000) return null;
      const bucket = attempts.get(email) ?? { count: 0, until: now + 15 * 60000 };
      attempts.set(email, bucket); bucket.count++;
      if (bucket.count > 5) return null;
      try {
        const user = await recordsDb().user.findUnique({ where: { email }, select: { id: true, name: true, email: true, password: true, role: true, isSuspended: true, deletedAt: true } });
        const valid = await bcrypt.compare(credentials.password, user?.password ?? '$2a$12$0000000000000000000000000000000000000000000000000000o');
        if (!valid || !user || user.deletedAt || user.isSuspended || !['TENANT', 'LANDLORD'].includes(user.role)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, language: 'en', isSuspended: false };
      } catch { return null; }
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.authenticatedAt = Date.now(); }
      if (!token.id) return token;
      try {
        const current = await recordsDb().user.findUnique({ where: { id: token.id }, select: { role: true, isSuspended: true, deletedAt: true, passwordChangedAt: true } });
        if (!current || current.deletedAt || current.isSuspended || !['TENANT', 'LANDLORD'].includes(current.role) ||
          typeof token.authenticatedAt !== 'number' || (current.passwordChangedAt && current.passwordChangedAt.getTime() > token.authenticatedAt)) return { ...token, id: '', role: '' };
        token.role = current.role;
      } catch { return { ...token, id: '', role: '' }; }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id || ''; session.user.role = token.role || ''; return session;
    },
    async redirect() { return 'http://127.0.0.1:3031/records'; },
  },
};
