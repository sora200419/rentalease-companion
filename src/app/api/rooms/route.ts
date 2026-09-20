// src/app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const roomSchema = z.object({
  propertyId: z.string().min(1),
  label: z.string().min(1).max(100),
  roomType: z.enum(['MASTER', 'MEDIUM', 'SMALL', 'STUDIO', 'ENTIRE_UNIT']),
  bathroomType: z.enum(['ATTACHED', 'SHARED']),
  bathrooms: z.coerce.number().int().min(1).max(10),
  rentAmount: z.coerce.number().positive(),
  furnishing: z.enum(['FULLY_FURNISHED', 'PARTIALLY_FURNISHED', 'UNFURNISHED']),
  maxOccupants: z.coerce.number().int().min(1).max(20),
  sizeSqFt: z.coerce.number().int().positive().nullable().optional(),
  floorLevel: z.coerce.number().int().positive().nullable().optional(),
  wifiIncluded: z.boolean().default(false),
  waterIncluded: z.boolean().default(false),
  electricIncluded: z.boolean().default(false),
  genderPreference: z.enum(['ANY', 'MALE_ONLY', 'FEMALE_ONLY']).default('ANY'),
  notes: z.string().max(1000).nullable().optional(),
});

// GET /api/rooms?propertyId=xxx
// Returns all rooms for a property the landlord owns.
// Used by AddRoomForm and the create-tenancy flow to list available rooms.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const propertyId = request.nextUrl.searchParams.get('propertyId');
  if (!propertyId)
    return NextResponse.json(
      { error: 'propertyId query param is required' },
      { status: 400 },
    );

  // Verify the property belongs to this landlord before listing its rooms
  const property = await prisma.property.findFirst({
    where: { id: propertyId, landlordId: session.user.id },
  });
  if (!property)
    return NextResponse.json(
      { error: 'Property not found or access denied' },
      { status: 404 },
    );

  const rooms = await prisma.room.findMany({
    where: { propertyId },
    include: {
      // Include the active tenancy (if any) so the UI can show occupancy per room
      tenancies: {
        where: { status: { in: ['INVITED', 'PENDING', 'ACTIVE'] } },
        include: {
          tenant: { select: { name: true, email: true } },
        },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ rooms });
}

// POST /api/rooms
// Creates a new room under a property the landlord owns.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const data = roomSchema.parse(body);

    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, landlordId: session.user.id },
    });
    if (!property)
      return NextResponse.json(
        { error: 'Property not found or access denied' },
        { status: 404 },
      );

    const room = await prisma.room.create({
      data: {
        propertyId: data.propertyId,
        label: data.label,
        roomType: data.roomType,
        bathroomType: data.bathroomType,
        bathrooms: data.bathrooms,
        rentAmount: data.rentAmount,
        furnishing: data.furnishing,
        maxOccupants: data.maxOccupants,
        sizeSqFt: data.sizeSqFt ?? null,
        floorLevel: data.floorLevel ?? null,
        wifiIncluded: data.wifiIncluded,
        waterIncluded: data.waterIncluded,
        electricIncluded: data.electricIncluded,
        genderPreference: data.genderPreference,
        notes: data.notes ?? null,
        isAvailable: true,
      },
    });

    return NextResponse.json(
      { message: 'Room created successfully', room },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 },
    );
  }
}
