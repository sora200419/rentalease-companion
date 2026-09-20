import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { extractAgreementTerms } from '@/lib/gemini';
import { agreementExtractTermsLimit, enforceLimit } from '@/lib/ratelimit';

/**
 * POST /api/agreements/[id]/extract-terms
 *
 * Read-only: calls Gemini to extract { startDate, endDate, monthlyRent,
 * depositAmount } from the agreement's rawContent. Does NOT write anything.
 *
 * Returns ExtractedTerms — any field can be null if the model couldn't
 * determine it. The caller should fall back to current system values for nulls.
 *
 * Rate limit: 10 calls per agreement per hour. Each call costs a Gemini API
 * request, so without this an authenticated landlord could trivially drain
 * the AI budget by spamming the button. Mirrors agreementAssistLimit.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: agreementId } = await params;

  const agreement = await prisma.agreement.findFirst({
    where: {
      id: agreementId,
      tenancy: { room: { property: { landlordId: session.user.id } } },
    },
    select: { id: true, status: true, rawContent: true },
  });

  if (!agreement)
    return NextResponse.json(
      { error: 'Agreement not found or access denied' },
      { status: 404 },
    );

  if (!['DRAFT', 'NEGOTIATING'].includes(agreement.status))
    return NextResponse.json(
      { error: 'Agreement is no longer editable' },
      { status: 409 },
    );

  // Rate limit AFTER ownership check so unauthorized callers don't get to consume
  // the per-agreement bucket and DoS the legitimate landlord.
  const { allowed, message } = await enforceLimit(
    agreementExtractTermsLimit,
    agreementId,
    'Too many extraction requests for this agreement. Please wait an hour.',
  );
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  try {
    const terms = await extractAgreementTerms(agreement.rawContent);
    return NextResponse.json(terms);
  } catch (error) {
    console.error('Term extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract terms from agreement.' },
      { status: 500 },
    );
  }
}
