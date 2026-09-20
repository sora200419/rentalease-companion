import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { shouldResetKycForIcChange } from '@/lib/kyc-workflow';

// Malaysian IC (MyKad/NRIC) is always 12 digits in the format YYMMDD-PB-NNNC.
// We accept both the formatted version (with hyphens) and the raw digit string,
// strip hyphens before storing, and always store as 12 raw digits.
// This makes downstream string comparison and formatting straightforward.
const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().optional().nullable(),
  language: z.enum(['en', 'ms']).optional(),
  icNumber: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === '') return null;
      // Strip hyphens so both "901231-14-5678" and "901231145678" are accepted
      return val.replace(/-/g, '').trim();
    })
    .refine(
      (val) => val === null || /^\d{12}$/.test(val),
      'Malaysian IC must be exactly 12 digits (e.g. 901231-14-5678)',
    ),
});

// GET /api/profile
// Returns the currently authenticated user's profile data.
// Used to pre-fill the profile form on page load.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      icNumber: true,
      language: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user)
    return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ user });
}

// PATCH /api/profile
// Updates name, phone, and/or icNumber for the authenticated user.
// Email is intentionally excluded — changing email would break NextAuth sessions.
// Password changes would require a separate flow with bcrypt re-hashing.
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  try {
    const body = await request.json();
    // Check the raw body before parsing — Zod's optional+transform always produces
    // icNumber in the parsed output (as null), so 'icNumber' in data is always true.
    // We need to know if the client actually sent the field.
    const icExplicitlySent = 'icNumber' in body;
    const data = profileSchema.parse(body);

    // Build the update object dynamically — only include fields that were sent.
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if ('phone' in data) updateData.phone = data.phone;
    if (icExplicitlySent) {
      updateData.icNumber = data.icNumber;
      // Only reset verification when the IC number is actually being changed —
      // echoing back the same value (e.g. a name/phone-only save) must not
      // undo an admin's approval.
      const current = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          icNumber: true,
          kycSubmission: { select: { id: true } },
        },
      });
      if (data.icNumber !== current?.icNumber) {
        updateData.isVerified = false;
        if (
          shouldResetKycForIcChange({
            previousIcNumber: current?.icNumber ?? null,
            nextIcNumber: data.icNumber,
            hasKycSubmission: !!current?.kycSubmission,
          })
        ) {
          updateData.kycRejectedReason =
            'IC number changed. Please resubmit identity verification.';
        }
      }
    }
    if (data.language !== undefined) updateData.language = data.language;

    if (Object.keys(updateData).length === 0)
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );

    const shouldRejectExistingKyc =
      updateData.kycRejectedReason ===
      'IC number changed. Please resubmit identity verification.';

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          icNumber: true,
          role: true,
        },
      }),
      ...(shouldRejectExistingKyc
        ? [
            prisma.kycSubmission.update({
              where: { userId: session.user.id },
              data: {
                status: 'REJECTED',
                rejectedReason:
                  'IC number changed. Please resubmit identity verification.',
                reviewedById: null,
                reviewedAt: null,
              },
            }),
          ]
        : []),
    ]);

    return NextResponse.json(
      { message: 'Profile updated successfully.', user: updated },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    // Prisma unique constraint violation (e.g. IC number already registered)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'This IC number is already registered to another account.' },
        { status: 409 },
      );
    }
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile.' },
      { status: 500 },
    );
  }
}
