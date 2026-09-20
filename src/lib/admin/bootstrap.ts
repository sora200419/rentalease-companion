import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export type AdminBootstrapEnv = {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_NAME?: string;
};

export type ExistingUserRole = 'LANDLORD' | 'TENANT' | 'ADMIN';

export type ExistingUser = {
  id: string;
  role: ExistingUserRole;
  name: string;
} | null;

export type AdminBootstrapDecision =
  | { status: 'missing-env' }
  | {
      status: 'create';
      email: string;
      password: string;
      name: string;
    }
  | {
      status: 'promote';
      userId: string;
      email: string;
      name: string;
    }
  | {
      status: 'noop';
      userId: string;
      email: string;
      name: string;
    };

export function buildAdminBootstrapDecision(input: {
  env: AdminBootstrapEnv;
  existingUser: ExistingUser;
}): AdminBootstrapDecision {
  const email = input.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = input.env.ADMIN_PASSWORD?.trim() ?? '';
  const name = input.env.ADMIN_NAME?.trim() || 'RentalEase Admin';

  if (!email || !password) {
    return { status: 'missing-env' as const };
  }

  if (!input.existingUser) {
    return { status: 'create' as const, email, password, name };
  }

  if (input.existingUser.role !== 'ADMIN') {
    return {
      status: 'promote' as const,
      userId: input.existingUser.id,
      email,
      name,
    };
  }

  return {
    status: 'noop' as const,
    userId: input.existingUser.id,
    email,
    name,
  };
}

export type AdminBootstrapResult =
  | { ok: false; action: 'missing-env' }
  | { ok: true; action: 'created' | 'promoted' | 'noop'; email: string };

export async function ensureAdminBootstrap(): Promise<AdminBootstrapResult> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const existingUser = email
    ? await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true, name: true },
      })
    : null;

  const decision = buildAdminBootstrapDecision({
    env: {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      ADMIN_NAME: process.env.ADMIN_NAME,
    },
    existingUser,
  });

  if (decision.status === 'missing-env') {
    return { ok: false, action: 'missing-env' };
  }

  if (decision.status === 'noop') {
    return { ok: true, action: 'noop', email: decision.email };
  }

  if (decision.status === 'promote') {
    await prisma.user.update({
      where: { id: decision.userId },
      data: {
        role: 'ADMIN',
        name: decision.name,
        isVerified: true,
      },
    });

    return { ok: true, action: 'promoted', email: decision.email };
  }

  const passwordHash = await bcrypt.hash(decision.password, 12);
  await prisma.user.upsert({
    where: { email: decision.email },
    create: {
      name: decision.name,
      email: decision.email,
      password: passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
    update: {},
  });

  return { ok: true, action: 'created', email: decision.email };
}
