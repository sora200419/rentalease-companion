// src/app/api/condition-reports/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { ReportType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canCreateMoveInConditionReport } from '@/lib/tenancyLifecycle';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenancyId = searchParams.get('tenancyId');

  if (!tenancyId) {
    return NextResponse.json(
      { error: 'tenancyId is required' },
      { status: 400 },
    );
  }

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      room: { include: { property: { select: { landlordId: true } } } },
    },
  });

  if (!tenancy) {
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  const isLandlord = tenancy.room.property.landlordId === session.user.id;
  const isTenant = tenancy.tenantId === session.user.id;

  if (!isLandlord && !isTenant) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const reports = await prisma.conditionReport.findMany({
    where: { tenancyId },
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      acknowledgedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      photos: { orderBy: { createdAt: 'asc' } },
      checklistItems: { orderBy: { area: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(reports);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    tenancyId?: string;
    type?: string;
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { tenancyId, type, notes } = body;

  if (!tenancyId || !type) {
    return NextResponse.json(
      { error: 'tenancyId and type are required' },
      { status: 400 },
    );
  }

  if (!['MOVE_IN', 'MOVE_OUT', 'INSPECTION'].includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }
  const reportType = type as ReportType;

  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      tenant: { select: { id: true, name: true } },
      room: {
        include: {
          property: {
            include: {
              landlord: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!tenancy) {
    return NextResponse.json({ error: 'Tenancy not found' }, { status: 404 });
  }

  const landlordId = tenancy.room.property.landlordId;
  const isLandlord = landlordId === session.user.id;
  const isTenant = tenancy.tenantId === session.user.id;

  if (!isLandlord && !isTenant) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const canCreateForStatus =
    reportType === 'MOVE_IN'
      ? canCreateMoveInConditionReport({
          tenancyStatus: tenancy.status,
          depositStatus: tenancy.depositStatus,
        })
      : ['ACTIVE', 'EXPIRED', 'TERMINATED'].includes(tenancy.status);

  if (!canCreateForStatus) {
    const message =
      reportType === 'MOVE_IN'
        ? 'A move-in report can only be created after the agreement is signed and the deposit payment is confirmed.'
        : 'A condition report cannot be created for a tenancy that has not yet started.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  if (reportType !== 'INSPECTION') {
    const existing = await prisma.conditionReport.findFirst({
      where: { tenancyId, type: reportType },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: `A ${reportType.toLowerCase().replace('_', '-')} report already exists for this tenancy.`,
        },
        { status: 409 },
      );
    }
  }

  const report = await prisma.conditionReport.create({
    data: {
      tenancyId,
      type: reportType,
      notes: notes ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
