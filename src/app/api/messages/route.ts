import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const tenancyId = request.nextUrl.searchParams.get('tenancyId');
  if (!tenancyId)
    return NextResponse.json(
      { error: 'tenancyId is required' },
      { status: 400 },
    );

  // Landlord ownership now goes through room → property → landlordId
  const tenancy = await prisma.tenancy.findFirst({
    where: {
      id: tenancyId,
      OR: [
        { tenantId: session.user.id },
        { room: { property: { landlordId: session.user.id } } },
      ],
    },
  });

  if (!tenancy)
    return NextResponse.json(
      { error: 'Tenancy not found or access denied' },
      { status: 404 },
    );

  const [messages] = await Promise.all([
    prisma.message.findMany({
      where: { tenancyId },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.updateMany({
      where: { tenancyId, receiverId: session.user.id, read: false },
      data: { read: true },
    }),
  ]);

  return NextResponse.json({ messages });
}

const sendSchema = z.object({
  tenancyId: z.string().min(1),
  content: z.string().min(1, 'Message cannot be empty').max(2000),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  try {
    const body = await request.json();
    const { tenancyId, content } = sendSchema.parse(body);

    // The landlordId now lives at tenancy.room.property.landlordId
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: tenancyId,
        OR: [
          { tenantId: session.user.id },
          { room: { property: { landlordId: session.user.id } } },
        ],
      },
      include: {
        room: {
          include: {
            property: { select: { landlordId: true } },
          },
        },
      },
    });

    if (!tenancy)
      return NextResponse.json(
        { error: 'Tenancy not found or access denied' },
        { status: 404 },
      );

    const landlordId = tenancy.room.property.landlordId;

    const receiverId =
      session.user.id === tenancy.tenantId ? landlordId : tenancy.tenantId;

    const message = await prisma.message.create({
      data: {
        tenancyId,
        senderId: session.user.id,
        receiverId,
        content,
        read: false,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 },
    );
  }
}
