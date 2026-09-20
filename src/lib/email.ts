// src/lib/email.ts
// Centralised email sending via Resend.
// All transactional emails go through this module.
// Never throws — a failed email must not fail the primary action.
import { Resend } from 'resend';

// Lazy-initialised so the module loads safely at build time without the key present.
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY!);
  return _resend;
}
const FROM = process.env.EMAIL_FROM ?? 'RentalEase <onboarding@resend.dev>';

function h(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function send(to: string, subject: string, html: string) {
  try {
    await getResend().emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Failed to send:', { to, subject, err });
  }
}

// ── Templates ──────────────────────────────────────────────────────────────────

function base(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:20px 32px;">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">RentalEase</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${title}</h2>
          ${body}
          ${cta ? `<div style="margin-top:24px;"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a></div>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">This email was sent by RentalEase Malaysia. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`;
}

// ── Email senders ──────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await send(
    to,
    'Reset your RentalEase password',
    base(
      'Password Reset Request',
      p('We received a request to reset your password. Click the button below to choose a new one. The link expires in 1 hour.') +
      p('If you did not request this, you can safely ignore this email.'),
      { label: 'Reset Password', url: resetUrl },
    ),
  );
}

export async function sendWelcomeEmail(to: string, name: string, role: 'LANDLORD' | 'TENANT') {
  const roleLabel = role === 'LANDLORD' ? 'landlord' : 'tenant';
  await send(
    to,
    'Welcome to RentalEase!',
    base(
      `Welcome, ${h(name)}!`,
      p(`Your ${roleLabel} account has been created. Complete identity verification from your dashboard to unlock restricted features.`) +
      p('You can still sign in, explore your dashboard, and set up your profile.'),
      { label: 'Go to Dashboard', url: `${process.env.NEXTAUTH_URL}/dashboard/${roleLabel}` },
    ),
  );
}

export async function sendKycApprovedEmail(to: string, name: string) {
  await send(
    to,
    'Your identity has been verified',
    base(
      'Identity Verified',
      p(`Hi ${h(name)}, your identity documents have been reviewed and approved.`) +
      p('You can now accept tenancy invitations and use all features of RentalEase.'),
      { label: 'Go to Dashboard', url: `${process.env.NEXTAUTH_URL}/dashboard` },
    ),
  );
}

export async function sendKycRejectedEmail(to: string, name: string, reason: string) {
  await send(
    to,
    'Action required: identity verification',
    base(
      'Identity Verification Rejected',
      p(`Hi ${h(name)}, your identity documents were not approved for the following reason:`) +
      `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0;font-size:14px;color:#dc2626;">${h(reason)}</p>
      </div>` +
      p('Please resubmit your identity verification with clearer photos.'),
      { label: 'Resubmit Verification', url: `${process.env.NEXTAUTH_URL}/dashboard/kyc` },
    ),
  );
}

export async function sendInvitationEmail(
  to: string,
  tenantName: string,
  propertyAddress: string,
  landlordName: string,
) {
  await send(
    to,
    'You have a new tenancy invitation',
    base(
      'Tenancy Invitation',
      p(`Hi ${h(tenantName)}, ${h(landlordName)} has invited you to a tenancy at <strong>${h(propertyAddress)}</strong>.`) +
      p('Log in to your dashboard to review the details and accept or decline.'),
      { label: 'View Invitation', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy` },
    ),
  );
}

export async function sendAgreementReadyEmail(
  to: string,
  tenantName: string,
  propertyAddress: string,
  agreementId: string,
) {
  await send(
    to,
    'Your tenancy agreement is ready to review',
    base(
      'Agreement Ready for Review',
      p(`Hi ${h(tenantName)}, your landlord has finalised the tenancy agreement for <strong>${h(propertyAddress)}</strong>.`) +
      p('Please review and sign at your earliest convenience.'),
      { label: 'Review Agreement', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy` },
    ),
  );
}

export async function sendAgreementSignedEmail(
  to: string,
  landlordName: string,
  tenantName: string,
  propertyAddress: string,
  tenancyId: string,
) {
  await send(
    to,
    `${h(tenantName)} signed the tenancy agreement`,
    base(
      'Agreement Signed',
      p(`Hi ${h(landlordName)}, ${h(tenantName)} has signed the tenancy agreement for <strong>${h(propertyAddress)}</strong>.`) +
      p('The tenancy is now active and rent payments have been scheduled.'),
      { label: 'View Tenancy', url: `${process.env.NEXTAUTH_URL}/dashboard/landlord/tenancies/${tenancyId}` },
    ),
  );
}

export async function sendPaymentApprovedEmail(
  to: string,
  tenantName: string,
  amount: string,
  month: string,
) {
  await send(
    to,
    'Your rent payment has been confirmed',
    base(
      'Payment Confirmed',
      p(`Hi ${h(tenantName)}, your rent payment of <strong>RM ${h(amount)}</strong> for ${h(month)} has been approved by your landlord.`),
      { label: 'View Payments', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/payments` },
    ),
  );
}

export async function sendPaymentRejectedEmail(
  to: string,
  tenantName: string,
  amount: string,
  month: string,
  reason: string,
) {
  await send(
    to,
    'Action required: rent payment rejected',
    base(
      'Payment Proof Rejected',
      p(`Hi ${h(tenantName)}, your rent payment proof of <strong>RM ${h(amount)}</strong> for ${h(month)} was rejected.`) +
      `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:12px 0;">
        <p style="margin:0;font-size:14px;color:#dc2626;">${h(reason)}</p>
      </div>` +
      p('Please upload a new proof from your payments page.'),
      { label: 'View Payments', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/payments` },
    ),
  );
}

export async function sendDepositSettlementEmail(
  to: string,
  tenantName: string,
  propertyAddress: string,
) {
  await send(
    to,
    'Your landlord has initiated deposit settlement',
    base(
      'Deposit Settlement Started',
      p(`Hi ${h(tenantName)}, your landlord has initiated the deposit settlement process for <strong>${h(propertyAddress)}</strong>.`) +
      p('Please review the proposed deductions and respond to each one.'),
      { label: 'Review Settlement', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy` },
    ),
  );
}

export async function sendDepositRefundPaidEmail(
  to: string,
  tenantName: string,
  amount: string,
) {
  await send(
    to,
    'Your deposit refund has been paid',
    base(
      'Deposit Refund Paid',
      p(`Hi ${h(tenantName)}, your landlord has transferred your deposit refund of <strong>RM ${h(amount)}</strong>.`) +
      p('Proof of payment has been uploaded to your tenancy page.'),
      { label: 'View Tenancy', url: `${process.env.NEXTAUTH_URL}/dashboard/tenant/tenancy` },
    ),
  );
}

export async function sendTenancyEndingSoonEmail(
  to: string,
  recipientName: string,
  propertyAddress: string,
  daysLeft: number,
  dashboardUrl: string,
) {
  await send(
    to,
    `Tenancy ending in ${daysLeft} days`,
    base(
      `Tenancy Ending in ${daysLeft} Days`,
      p(`Hi ${h(recipientName)}, the tenancy for <strong>${h(propertyAddress)}</strong> ends in <strong>${daysLeft} days</strong>.`) +
      p(daysLeft <= 7
        ? 'Please prepare for the upcoming move-out and ensure all keys are returned.'
        : 'Please plan ahead and discuss renewal or move-out arrangements with the other party.'),
      { label: 'View Tenancy', url: dashboardUrl },
    ),
  );
}
