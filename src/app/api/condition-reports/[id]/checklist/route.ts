import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isConditionReportLocked } from '@/lib/conditionReportWorkflow';

const VALID_REASONS = [
  'PHOTO_UPLOADED',
  'NO_ISSUE_OBSERVED',
  'NOT_APPLICABLE',
  'CANNOT_ACCESS',
] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: reportId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { area, completionReason } = body;

  if (!area || typeof area !== 'string' || area.trim().length === 0)
    return NextResponse.json({ error: 'area is required' }, { status: 400 });

  if (!VALID_REASONS.includes(completionReason))
    return NextResponse.json(
      { error: `completionReason must be one of: ${VALID_REASONS.join(', ')}` },
      { status: 400 },
    );

  const report = await prisma.conditionReport.findFirst({
    where: {
      id: reportId,
      tenancy: {
        OR: [
          { tenantId: session.user.id },
          { room: { property: { landlordId: session.user.id } } },
        ],
      },
    },
    select: { id: true, status: true },
  });

  if (!report)
    return NextResponse.json(
      { error: 'Report not found or access denied' },
      { status: 404 },
    );

  if (isConditionReportLocked(report.status))
    return NextResponse.json(
      { error: 'This report is locked and cannot be modified.' },
      { status: 409 },
    );

  const item = await prisma.evidenceChecklistItem.upsert({
    where: { reportId_area: { reportId, area: area.trim() } },
    create: { reportId, area: area.trim(), completionReason },
    update: { completionReason },
  });

  return NextResponse.json(item, { status: 200 });
}
