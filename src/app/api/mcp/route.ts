import { getServerSession } from 'next-auth';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { listAuthorizedTenancies, retrieveTenancyRecords } from '@/lib/companion/database';
import { handleRecordsMcp } from '@/lib/companion/mcp-server';
import { DEMO_HTTP, JUDGE_PROFILE, judgeMcpServices, sharedJudgeStore } from '@/lib/companion/judge-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  if (process.env.COMPANION_RECORDS_MODE === '1') return handleRecordsMcp(request, {
    authenticate: async () => (await getServerSession(recordsAuthOptions))?.user.id || null,
    list: actorId => listAuthorizedTenancies(recordsDb(), actorId),
    get: (actorId, tenancyId) => retrieveTenancyRecords(recordsDb(), actorId, tenancyId),
  });
  // The independent demo serves the same read-only tools over its synthetic case.
  if (process.env.COMPANION_OFFLINE_DEMO === '1')
    return handleRecordsMcp(request, { ...judgeMcpServices(sharedJudgeStore()), profile: JUDGE_PROFILE }, DEMO_HTTP);
  return new Response(null, { status: 404 });
}
export { handle as POST, handle as GET, handle as DELETE };
