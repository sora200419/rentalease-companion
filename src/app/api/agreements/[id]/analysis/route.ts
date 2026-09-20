import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  analyzeAgreementContent,
  translateAgreementOutputs,
} from '@/lib/gemini';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.user.role !== 'LANDLORD') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: agreementId } = await params;

  const agreement = await prisma.agreement.findFirst({
    where: {
      id: agreementId,
      tenancy: {
        room: { property: { landlordId: session.user.id } },
      },
    },
    select: {
      id: true,
      status: true,
      rawContent: true,
      revisions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!agreement) {
    return NextResponse.json(
      { error: 'Agreement not found or access denied' },
      { status: 404 },
    );
  }

  if (agreement.status === 'SIGNED') {
    return NextResponse.json(
      { error: 'Signed agreements do not support analysis refresh.' },
      { status: 409 },
    );
  }

  try {
    const analysis = await analyzeAgreementContent(agreement.rawContent);

    let plainLanguageSummaryMs: string | null = null;
    let redFlagsMs: string | null = null;

    try {
      const translated = await translateAgreementOutputs(
        analysis.plainLanguageSummary,
        analysis.redFlags,
      );
      plainLanguageSummaryMs = translated.plainLanguageSummaryMs;
      redFlagsMs = translated.redFlagsMs;
    } catch (translationError) {
      console.error(
        'Agreement analysis translation failed; saving English analysis only.',
        translationError,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.agreement.update({
        where: { id: agreementId },
        data: {
          plainLanguageSummary: analysis.plainLanguageSummary,
          plainLanguageSummaryMs,
          redFlags: analysis.redFlags,
          redFlagsMs,
          updatedAt: new Date(),
        },
      });

      if (agreement.revisions[0]?.id) {
        await tx.agreementRevision.update({
          where: { id: agreement.revisions[0].id },
          data: {
            plainLanguageSummary: analysis.plainLanguageSummary,
            plainLanguageSummaryMs,
            redFlags: analysis.redFlags,
            redFlagsMs,
          },
        });
      }
    });

    return NextResponse.json(
      { message: 'AI analysis refreshed successfully.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Agreement analysis refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh AI analysis.' },
      { status: 500 },
    );
  }
}
