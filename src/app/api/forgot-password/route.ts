import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { forgotPasswordRateLimit, enforceLimit } from '@/lib/ratelimit';
import crypto from 'crypto';

/**
 * Hash a raw token to its storage form.
 *
 * We only ever PERSIST the SHA-256 of the token sent in the user's email.
 * If the database leaks, an attacker has the hashes but cannot recover the
 * raw tokens needed to actually reset a password — they'd have to pre-image
 * SHA-256, which is computationally infeasible.
 *
 * This mirrors how OAuth, Stripe, GitHub, etc. store API keys and reset tokens.
 */
function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalisedEmail = email.toLowerCase().trim();

  // Rate limit by email — caps both the email-bombing surface (your Resend
  // bill) and the timing-based account-enumeration surface (an attacker can't
  // probe 10,000 emails per second to see which ones take longer because they
  // exist in the DB).
  const { allowed, message } = await enforceLimit(
    forgotPasswordRateLimit,
    normalisedEmail,
    'Too many reset requests. Please wait 15 minutes before trying again.',
  );
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  // Always return success to prevent email enumeration
  if (!user) {
    return NextResponse.json({ success: true });
  }

  // Invalidate any previous unused tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  // Generate a 32-byte random token (256 bits of entropy). The RAW token goes
  // in the email URL; only its SHA-256 hash is stored in the DB. See
  // hashResetToken() above for rationale.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { token: tokenHash, userId: user.id, expiresAt },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return NextResponse.json({ success: true });
}
