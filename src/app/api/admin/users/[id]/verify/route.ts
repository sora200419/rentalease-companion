import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json(
    { error: 'Legacy user verification is deprecated. Review KYC submissions from /dashboard/admin/kyc.' },
    { status: 410 },
  );
}
