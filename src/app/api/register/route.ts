import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email';
import { z } from 'zod';
import { registerRateLimit, enforceLimit } from '@/lib/ratelimit';
import { getIp } from '@/lib/audit';

// Malaysian IC: YYMMDD-SS-#### or YYMMDSS#### (12 digits, optional dashes)
const IC_REGEX = /^\d{6}-?\d{2}-?\d{4}$/;

function isValidIcDate(ic: string): boolean {
  const digits = ic.replace(/-/g, '');
  const mm = parseInt(digits.slice(2, 4), 10);
  const dd = parseInt(digits.slice(4, 6), 10);
  const yy = parseInt(digits.slice(0, 2), 10);
  const currentYY = new Date().getFullYear() % 100;
  const year = yy > currentYY ? 1900 + yy : 2000 + yy;
  const date = new Date(year, mm - 1, dd);
  return date.getFullYear() === year && date.getMonth() === mm - 1 && date.getDate() === dd;
}

const fieldsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['LANDLORD', 'TENANT']),
  phone: z.string().optional().default(''),
  icNumber: z
    .string()
    .min(1, 'IC number is required')
    .regex(IC_REGEX, 'Invalid IC format - e.g. 900101-14-5678 or 900101145678')
    .refine(isValidIcDate, 'Invalid date in IC number'),
});

export async function POST(request: NextRequest) {
  // Rate limit by IP — caps the "create 10,000 fake accounts" attack. A genuine
  // user registers once; this only impedes scripted abuse.
  const ip = getIp(request) ?? 'unknown';
  const { allowed, message } = await enforceLimit(
    registerRateLimit,
    ip,
    'Too many registration attempts. Please try again in an hour.',
  );
  if (!allowed) {
    return NextResponse.json({ error: message }, { status: 429 });
  }

  try {
    const formData = await request.formData();

    const raw = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as string,
      phone: formData.get('phone') as string,
      icNumber: formData.get('icNumber') as string,
    };

    const validated = fieldsSchema.parse(raw);
    const icNumber = validated.icNumber.replace(/-/g, '');

    const existingEmail = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const existingIc = await prisma.user.findUnique({
      where: { icNumber },
      select: { id: true },
    });
    if (existingIc) {
      return NextResponse.json(
        { error: 'An account with this IC number already exists' },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
        role: validated.role as 'LANDLORD' | 'TENANT',
        phone: validated.phone,
        icNumber,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    sendWelcomeEmail(validated.email, validated.name, validated.role as 'LANDLORD' | 'TENANT').catch(console.error);

    return NextResponse.json(
      { message: 'Account created successfully', user },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    }
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating the account' },
      { status: 500 },
    );
  }
}
