import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { resetPasswordRateLimit, enforceLimit } from '@/lib/ratelimit';
import { getIp } from '@/lib/audit';
import crypto from 'crypto';

const bodySchema = z.object({
  token: z
    .string()
    .min(32, 'Invalid reset link')
    .max(256, 'Invalid reset link'),
  // 12-char minimum aligns with current NIST guidance (SP 800-63B). The previous
  // 8-char floor was below the modern recommended baseline.
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function POST(req: Request) {
  // Defense-in-depth rate limit. Tokens are 2^256 random, so brute-forcing the
  // token is already infeasible — this caps the attempt rate anyway so we don't
  // burn CPU on bcrypt.hash() under a flood.
  const ip = getIp(req) ?? 'unknown';
  const { allowed, message } = await enforceLimit(
    resetPasswordRateLimit,
    ip,
    'Too many reset attempts. Please wait 15 minutes before trying again.',
  );
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }
  const { token, password } = parsed.data;

  // The DB stores sha256(rawToken), not the raw token. Hash the incoming
  // value and look it up by hash. See forgot-password/route.ts for rationale.
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired' },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  const now = new Date();

  // Atomic: update password + mark token used + bump passwordChangedAt.
  // The bumped timestamp is what makes existing JWT sessions invalid (see
  // jwt() callback in lib/auth.ts) — without this, an attacker who stole a
  // session before the reset would still have a valid token.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed, passwordChangedAt: now },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
  ]);

  return NextResponse.json({ success: true });
}
