import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

// Property-level fields only — bedrooms, bathrooms, rentAmount have moved to Room
const propertySchema = z.object({
  address: z.string().min(5, 'Please enter a full street address'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(1, 'Please select a state'),
  postcode: z.string().regex(/^\d{5}$/, 'Postcode must be exactly 5 digits'),
  type: z.string().min(1, 'Please select a property type'),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (session.user.role !== 'LANDLORD')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // KYC gate — landlord must be verified before listing properties
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isVerified: true },
  });
  if (!currentUser?.isVerified) {
    return NextResponse.json(
      { error: 'Your account must be verified before you can list properties. Please wait for admin approval of your identity documents.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const data = propertySchema.parse(body);

    const property = await prisma.property.create({
      data: {
        ...data,
        landlordId: session.user.id,
      },
      select: {
        id: true,
        address: true,
        city: true,
        type: true,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        createNotification(
          admin.id,
          'PROPERTY_SUBMITTED',
          'New property submitted',
          `A new property at "${property.address}" has been submitted for verification.`,
          '/dashboard/admin/properties',
        ),
      ),
    );

    return NextResponse.json(
      { message: 'Property created successfully', property },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    console.error('Create property error:', error);
    return NextResponse.json(
      { error: 'Failed to create property' },
      { status: 500 },
    );
  }
}
