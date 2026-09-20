// src/lib/ratelimit.ts
// Upstash Redis-backed rate limiting for expensive endpoints and auth.
//
// Convention: keys passed to .limit() should be opaque, low-cardinality identifiers
// (email, IP, tenancyId, agreementId). For auth-style endpoints we compose
// `${email}:${ip}` so an attacker can't lock out a victim by hammering their email
// from a single attacker IP — see authorize() in lib/auth.ts.
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Agreement generation: 5 requests per tenancy per hour
export const agreementGenerateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:agreement:generate',
  analytics: true,
});

// AI assist: 10 requests per agreement per hour
export const agreementAssistLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'rl:agreement:assist',
  analytics: true,
});

// AI term extraction: 10 requests per agreement per hour. Modelled on
// agreementAssistLimit because both call Gemini on the same content.
export const agreementExtractTermsLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'rl:agreement:extract-terms',
  analytics: true,
});

// Login: 5 attempts per (email, IP) tuple per 15 minutes. Keying on both prevents
// an attacker from locking out a victim by spamming their email from one IP.
// Falls back to email-only if IP is unavailable (better something than nothing).
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:login',
  analytics: true,
});

// Registration: 5 accounts per IP per hour. Stops the obvious "create 10,000 fake
// accounts" attack. Legitimate users register once and never hit this.
export const registerRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:register',
  analytics: true,
});

// Forgot-password: 3 requests per email per 15 minutes. Caps the email-bombing
// amplification surface (your Resend bill) and stops slow account enumeration
// via the response time of the user lookup.
export const forgotPasswordRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '15 m'),
  prefix: 'rl:forgot-password',
  analytics: true,
});

// Reset-password: 10 attempts per IP per 15 minutes. Caps brute-force on the
// reset token URL. Tokens are 32 bytes of randomness (2^256), so brute-force is
// computationally infeasible anyway; this is defense-in-depth.
export const resetPasswordRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  prefix: 'rl:reset-password',
  analytics: true,
});

// KYC submission: 3 submissions per user per hour. KYC uploads three images
// to Cloudinary, so this also caps the upload bandwidth abuse surface.
export const kycSubmitRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'rl:kyc:submit',
  analytics: true,
});

/**
 * Helper: try to enforce a rate limit and return whether the request should
 * proceed. Swallows Redis outages (logs them) and returns true so we don't
 * lock the entire app out when Upstash has a hiccup.
 *
 * Returns { allowed: true } on success or Redis failure, { allowed: false,
 * message } when the limit is exceeded.
 */
export async function enforceLimit(
  limiter: Ratelimit,
  key: string,
  exceededMessage: string,
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const { success } = await limiter.limit(key);
    if (!success) {
      return { allowed: false, message: exceededMessage };
    }
    return { allowed: true };
  } catch (err) {
    console.error('[ratelimit] Redis unavailable, allowing request:', err);
    return { allowed: true };
  }
}
