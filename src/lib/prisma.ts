import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Verbose query logs are valuable in development but expensive (and
  // potentially leak query patterns / WHERE clauses to log retention) in
  // production. Gate accordingly. Errors are always logged.
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

// Singleton: reuse the same PrismaClient across hot reloads in development.
// Without this, every module re-evaluation creates a new 49-connection pool,
// quickly exhausting Postgres max_connections and causing P2024 timeouts.
// If you run `prisma generate` or `prisma migrate dev`, restart the dev server
// to pick up schema changes — do not rely on automatic re-instantiation.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
