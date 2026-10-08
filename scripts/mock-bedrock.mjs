// A local stand-in for the Amazon Bedrock Converse API (POST /model/{id}/converse over
// HTTP/2, as the SDK uses). It lets the real @aws-sdk/client-bedrock-runtime client
// sign, send and parse requests end to end without an AWS account or cost.
//
//   node scripts/mock-bedrock.mjs [request-log.jsonl]
//   COMPANION_BEDROCK_MODEL=apac.amazon.nova-pro-v1:0 COMPANION_BEDROCK_ENDPOINT=http://127.0.0.1:4599 \
//   AWS_REGION=ap-southeast-1 AWS_ACCESS_KEY_ID=mock AWS_SECRET_ACCESS_KEY=mock npm run dev:companion
//
// The scripted replies only exercise the integration; they are not model output.
import http2 from 'node:http2';
import { appendFileSync, writeFileSync } from 'node:fs';

const log = process.argv[2];
if (log) writeFileSync(log, '');
const send = (res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const turn = (content, stopReason) => ({ output: { message: { role: 'assistant', content } }, stopReason,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, metrics: { latencyMs: 1 } });

http2.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    if (log) appendFileSync(log, JSON.stringify({ url: req.url, auth: String(req.headers.authorization ?? '').split(' ')[0], body }) + '\n');
    const question = body.messages.filter(m => m.role === 'user' && m.content[0]?.text).at(-1)?.content[0].text ?? '';
    const result = body.messages.at(-1).content.find(c => c.toolResult)?.toolResult;
    if (result) {
      const data = result.content[0]?.json;
      if (data?.saved === false) return send(res, turn([{ text: 'I drafted a dispute that cites the move-in report [move-in]. Check it on screen, then press Confirm and save if you agree.' }], 'end_turn'));
      const text = /A short scuff was recorded/.test(JSON.stringify(data))
        ? 'The move-in report already recorded a short scuff below the bedroom window [move-in], and the move-out report mentions a wall scuff [move-out]. The records alone do not decide who pays.'
        : 'Here is what the records show [wall].';
      return send(res, turn([{ text: '<thinking>Answer from the tool result.</thinking>' + text }], 'end_turn'));
    }
    const revision = Number(/Current record revision: (\d+)/.exec(body.system?.[0]?.text ?? '')?.[1] ?? 0);
    if (/\bdispute\b/i.test(question)) return send(res, turn([{ toolUse: { toolUseId: 'mock-draft', name: 'prepare_dispute_action', input: {
      tenancyId: 'judge-synthetic-tenancy', expectedRevision: revision,
      action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text: 'The move-in report already recorded a short scuff below the bedroom window, so I dispute this repainting charge.' } } } } }], 'tool_use'));
    return send(res, turn([{ toolUse: { toolUseId: 'mock-evidence', name: 'get_deduction_evidence', input: { tenancyId: 'judge-synthetic-tenancy', deductionId: 'wall' } } }], 'tool_use'));
  });
}).listen(4599, '127.0.0.1', () => console.log('Mock Bedrock Converse listening on http://127.0.0.1:4599 (HTTP/2)'));
