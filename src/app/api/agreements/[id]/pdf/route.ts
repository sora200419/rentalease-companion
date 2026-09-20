// src/app/api/agreements/[id]/pdf/route.ts
// Generates a real PDF via @react-pdf/renderer and streams it to the client.
// Both landlord and tenant can download the agreement they are party to.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as ReactPDF from '@react-pdf/renderer';
import React from 'react';
import { AgreementPDF } from '@/lib/pdf/AgreementPDF';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const agreement = await prisma.agreement.findFirst({
    where: {
      id,
      tenancy: {
        OR: [
          { room: { property: { landlordId: session.user.id } } },
          { tenantId: session.user.id },
        ],
      },
    },
    include: {
      tenancy: {
        include: {
          room: {
            include: {
              property: { select: { address: true, city: true, state: true } },
            },
          },
          tenant: { select: { name: true } },
        },
      },
    },
  });

  if (!agreement)
    return NextResponse.json(
      { error: 'Agreement not found or access denied' },
      { status: 404 },
    );

  const { address, city, state } = agreement.tenancy.room.property;

  try {
    const element = React.createElement(AgreementPDF, {
      rawContent: agreement.rawContent,
      tenantName: agreement.tenancy.tenant.name,
      address,
      city,
      state,
      roomLabel: agreement.tenancy.room.label,
      agreementId: agreement.id,
      status: agreement.status,
      contentHash: agreement.contentHash,
      signedAt: agreement.signedAt,
      signedByIp: agreement.signedByIp,
      txHash: agreement.txHash,
    }) as React.ReactElement<ReactPDF.DocumentProps>;

    const pdfBuffer = await ReactPDF.renderToBuffer(element);

    const fileName = `tenancy-agreement-${agreement.tenancy.tenant.name.replace(/\s+/g, '-')}.pdf`;

    // Convert Buffer → Uint8Array so NextResponse accepts it as BodyInit
    const body = new Uint8Array(pdfBuffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(body.length),
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
