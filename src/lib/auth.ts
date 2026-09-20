import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { loginRateLimit, enforceLimit } from './ratelimit';

// Single generic message for both "no such user" and "wrong password". Returning
// distinct messages would let attackers enumerate which emails are registered
// on the platform — that's both a privacy issue (PDPA 2010) and a kickstart
// for credential stuffing.
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        // Make sure email and password are provided
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const normalisedEmail = credentials.email.toLowerCase();

        // Rate limit: 5 attempts per (email, IP) tuple per 15 minutes.
        // Keying on the tuple stops an attacker from locking out a victim's
        // account by hammering their email from a single IP. The IP comes from
        // x-forwarded-for (Vercel populates this) — if absent, we still rate
        // limit by email alone to keep the protection rather than open the door.
        const forwardedFor = req?.headers?.['x-forwarded-for'];
        const ip = Array.isArray(forwardedFor)
          ? forwardedFor[0]
          : (forwardedFor?.split(',')[0]?.trim() ?? 'unknown');
        const limitKey = `${normalisedEmail}:${ip}`;
        const { allowed, message } = await enforceLimit(
          loginRateLimit,
          limitKey,
          'Too many login attempts. Please try again in 15 minutes.',
        );
        if (!allowed) {
          throw new Error(message);
        }

        // Find the user by email
        const user = await prisma.user.findUnique({
          where: { email: normalisedEmail },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            language: true,
            isSuspended: true,
            deletedAt: true,
            passwordChangedAt: true,
          },
        });

        // Constant-time-ish behavior: if no user, still perform a bcrypt
        // comparison against a fixed dummy hash before returning the generic
        // message. Without this an attacker can distinguish "no user" (fast
        // response) from "user exists, wrong password" (slow bcrypt response)
        // by timing — defeating the unified error message.
        if (!user) {
          await bcrypt.compare(
            credentials.password,
            '$2a$12$0000000000000000000000000000000000000000000000000000o',
          );
          throw new Error(INVALID_CREDENTIALS_MESSAGE);
        }

        // Soft-deleted and suspended messages are intentionally distinct —
        // those users genuinely need different UX guidance.
        if (user.deletedAt) {
          throw new Error('This account has been removed.');
        }

        if (user.isSuspended) {
          throw new Error('Your account has been suspended. Please contact support.');
        }

        // Compare the submitted password with the hashed password
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        if (!isValidPassword) {
          throw new Error(INVALID_CREDENTIALS_MESSAGE);
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          language: user.language ?? 'en',
          isSuspended: user.isSuspended,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session: updatedSession }) {
      if (user) {
        token.role = (user as { id: string; role: string; language: string }).role;
        token.id = user.id;
        token.language = (user as { language: string }).language ?? 'en';
        token.isSuspended = (user as { isSuspended: boolean }).isSuspended ?? false;
      } else if (token.id) {
        // Re-fetch suspension status AND passwordChangedAt on every subsequent
        // request. Suspension takes effect immediately without requiring
        // sign-out/sign-in. The passwordChangedAt comparison invalidates any
        // JWT issued before the most recent password change — kicks out
        // attackers holding a stolen JWT after the user does a password reset.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isSuspended: true, passwordChangedAt: true },
        });
        if (!dbUser) {
          // User was deleted out from under this session — invalidate.
          throw new Error('Session invalidated');
        }
        token.isSuspended = dbUser.isSuspended;
        // token.iat is in seconds since epoch; passwordChangedAt is a Date.
        if (
          dbUser.passwordChangedAt &&
          typeof token.iat === 'number' &&
          token.iat * 1000 < dbUser.passwordChangedAt.getTime()
        ) {
          throw new Error('Session invalidated by password change');
        }
      }
      // Allow updating name/language via session update() call
      if (trigger === 'update') {
        if (updatedSession?.language) token.language = updatedSession.language;
        if (updatedSession?.name) token.name = updatedSession.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
        session.user.language = (token.language as string) ?? 'en';
        session.user.isSuspended = token.isSuspended as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
