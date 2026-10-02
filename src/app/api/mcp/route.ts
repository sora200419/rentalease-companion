import { getServerSession } from 'next-auth';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { listAuthorizedTenancies, retrieveTenancyRecords } from '@/lib/companion/database';
import { handleRecordsMcp } from '@/lib/companion/mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (process.env.COMPANION_RECORDS_MODE !== '1') return new Response(null, { status: 404 });
  return handleRecordsMcp(request, {
    authenticate: async () => (await getServerSession(recordsAuthOptions))?.user.id || null,
    list: actorId => listAuthorizedTenancies(recordsDb(), actorId),
    get: (actorId, tenancyId) => retrieveTenancyRecords(recordsDb(), actorId, tenancyId),
  });
}
export { handle as POST, handle as GET, handle as DELETE };
