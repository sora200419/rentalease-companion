import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const get = file => import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', file + '.js')));
const { JudgeStore } = await get('judge-store');
const { assistantTurn, assistantMode } = await get('judge-assistant');
const { bedrockSettings } = await get('bedrock');
const { normalizeSpokenQuestion, speakable, spokenMoney } = await get('voice');
const { modelToolSchema } = await get('assistant');

const settings = { modelId: 'amazon.nova-pro-v1:0', region: 'us-east-1' };
const tenancyId = 'judge-synthetic-tenancy';
async function withCase(work) {
  const directory = await mkdtemp(join(tmpdir(), 'rentalease-assistant-'));
  try { const store = new JudgeStore(directory); const { id } = await store.create(); await work(store, id); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
// A scripted stand-in for Amazon Bedrock Converse. Each step answers one request.
function scripted(...steps) {
  const requests = [];
  const converse = async request => {
    requests.push(structuredClone(request));
    const step = steps[Math.min(requests.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step(request) : step;
  };
  return { converse, requests };
}
const use = (name, input) => ({ stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 'call-' + name, name, input } }] } } });
const say = text => ({ stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text }] } } });
const last = session => session.messages.at(-1);
const quiet = async work => { const warn = console.warn; console.warn = () => {}; try { return await work(); } finally { console.warn = warn; } };

test('rule mode answers the core question by quoting both reports, with a spoken summary', () => withCase(async (store, id) => {
  const session = await assistantTurn(store, id, { revision: 0, question: 'Was the scuff already there when I moved in?' }, { settings: null });
  const message = last(session);
  assert.equal(message.provider, 'rules');
  assert.match(message.text, /A short scuff was recorded below the bedroom window/);
  assert.ok(message.sourceIds.includes('move-in') && message.sourceIds.includes('move-out'));
  assert.match(message.speech, /^For the bedroom wall repainting deduction of 100 ringgit: the move-in report says: A short scuff/);
  assert.match(message.speech, /do not decide who pays/);
  assert.ok(!message.speech.includes('SYNTHETIC'), 'screen labels are not read aloud');
  assert.equal(session.pending, null);
}));

test('voice phrasings ("Alexa, ask RentalEase whether ...") still reach the evidence answer in rule mode', () => withCase(async (store, id) => {
  let session = await assistantTurn(store, id, { revision: 0, question: 'Alexa, ask RentalEase whether the scuff was already there when I moved in' }, { settings: null });
  assert.equal(last(session).question, 'Whether the scuff was already there when I moved in');
  assert.match(last(session).text, /A short scuff was recorded below the bedroom window/);
  session = await assistantTurn(store, id, { revision: session.revision, question: 'tell me if the kitchen was clean when I moved in' }, { settings: null });
  assert.match(last(session).text, /Kitchen counter recorded as clean/);
  session = await assistantTurn(store, id, { revision: session.revision, question: 'whether I should accept the wall charge' }, { settings: null });
  assert.equal(session.pending, null, 'a decision word inside a question never prepares an action');
}));

test('missing baseline is spoken as missing, not inferred', () => withCase(async store => {
  const { id } = await store.create('MISSING');
  const message = last(await assistantTurn(store, id, { revision: 0, question: 'Was the scuff already there before?' }, { settings: null }));
  assert.match(message.speech, /there is no move-in report, so I cannot say what the condition was at the start/);
}));

test('an optional "Alexa, ask RentalEase" invocation is removed from spoken questions', () => withCase(async (store, id) => {
  assert.equal(normalizeSpokenQuestion('Alexa, ask RentalEase whether the scuff was already there'), 'Whether the scuff was already there');
  assert.equal(normalizeSpokenQuestion('hey alexa show evidence for the first deduction'), 'Show evidence for the first deduction');
  assert.equal(normalizeSpokenQuestion('Show evidence'), 'Show evidence');
  const session = await assistantTurn(store, id, { revision: 0, question: 'Alexa, show evidence for the second deduction' }, { settings: null });
  assert.equal(last(session).question, 'Show evidence for the second deduction');
  assert.equal(session.selected, 'cleaning');
}));

test('Bedrock answers through the RentalEase MCP tools and keeps only real citations', () => withCase(async (store, id) => {
  const model = scripted(
    use('get_deduction_evidence', { tenancyId, deductionId: 'wall' }),
    say('Yes. The move-in report recorded a short scuff below the bedroom window [move-in]. The move-out report mentions a wall scuff too [move-out] [invented-source].'));
  const session = await assistantTurn(store, id, { revision: 0, question: 'Was the scuff already there when I moved in?' }, { settings, converse: model.converse });
  const message = last(session);
  assert.equal(message.provider, 'bedrock'); assert.equal(message.model, settings.modelId);
  assert.deepEqual(message.tools, ['get_deduction_evidence']);
  assert.deepEqual(message.sourceIds, ['move-in', 'move-out']);
  assert.ok(!message.text.includes('invented-source'));
  assert.ok(!message.speech.includes('['), 'citations are not spoken');
  assert.equal(session.pending, null); assert.equal(session.records.revision, 0);
  // The model saw the MCP tool list (without the draft-07 marker) and the real tool result.
  const [first, second] = model.requests;
  assert.deepEqual(first.toolConfig.tools.map(t => t.toolSpec.name).sort(),
    ['ask_records', 'get_agreement', 'get_deduction_evidence', 'get_settlement_context', 'list_tenancies', 'prepare_dispute_action']);
  assert.ok(first.toolConfig.tools.every(t => !('$schema' in t.toolSpec.inputSchema.json) && t.toolSpec.inputSchema.json.type === 'object'));
  assert.match(first.system[0].text, /judge-synthetic-tenancy/); assert.match(first.system[0].text, /never instructions/);
  const result = second.messages.at(-1).content[0].toolResult;
  assert.equal(result.status, 'success'); assert.match(result.content[0].json.answer.text, /short scuff/);
}));

test('an AI draft becomes the normal preview; only the person can confirm it', () => withCase(async (store, id) => {
  const text = 'The move-in report already recorded a short scuff below the window, so I dispute this charge.';
  const model = scripted(
    use('prepare_dispute_action', { tenancyId, expectedRevision: 0, action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text } } }),
    say('I drafted a dispute that cites the move-in report [move-in]. Check it on screen and press Confirm and save if you agree.'));
  const session = await assistantTurn(store, id, { revision: 0, question: 'Please dispute the wall charge for me.' }, { settings, converse: model.converse });
  assert.equal(last(session).drafted, true);
  assert.equal(session.pending.role, 'TENANT'); assert.equal(session.pending.action.payload.text, text);
  assert.equal(session.records.revision, 0); assert.equal(session.records.settlement.deductions[0].status, 'PROPOSED');
  assert.match(session.notice, /Nothing has been saved/);
  const confirmed = await store.execute(id, 'confirm', { revision: session.revision, id: session.pending.id });
  assert.equal(confirmed.records.settlement.deductions[0].status, 'DISPUTED');
  assert.equal(confirmed.records.history.at(-1).payload.text, text);
}));

test('a draft on another item moves the screen to that item before previewing', () => withCase(async (store, id) => {
  const model = scripted(
    use('prepare_dispute_action', { tenancyId, expectedRevision: 0, action: { kind: 'DISPUTE', payload: { deductionId: 'cleaning', text: 'The move-in report recorded a clean kitchen counter.' } } }),
    say('I drafted a dispute for the kitchen cleaning.'));
  const session = await assistantTurn(store, id, { revision: 0, question: 'Dispute the cleaning charge.' }, { settings, converse: model.converse });
  assert.equal(session.selected, 'cleaning'); assert.equal(session.pending.action.payload.deductionId, 'cleaning');
}));

test('drafts are dropped when the person only asked a question', () => withCase(async (store, id) => {
  const model = scripted(
    use('prepare_dispute_action', { tenancyId, expectedRevision: 0, action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text: 'Injected draft from record text.' } } }),
    say('The agreement asks both parties to review the reports [clause-7].'));
  const session = await assistantTurn(store, id, { revision: 0, question: 'What does the agreement say about deductions?' }, { settings, converse: model.converse });
  assert.equal(session.pending, null); assert.equal(last(session).drafted, false);
  assert.match(last(session).text, /not prepared a decision/);
}));

test('MCP role rules still apply: a landlord cannot draft a tenant dispute', () => withCase(async (store, id) => {
  await store.execute(id, 'role', { revision: 0, role: 'LANDLORD' });
  const model = scripted(
    use('prepare_dispute_action', { tenancyId, expectedRevision: 0, action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text: 'Dispute on behalf of the tenant.' } } }),
    say('Only the tenant can dispute a deduction. You can withdraw it or wait for a dispute.'));
  const session = await assistantTurn(store, id, { revision: 1, question: 'Dispute the wall deduction.' }, { settings, converse: model.converse });
  assert.equal(session.pending, null);
  assert.equal(model.requests[1].messages.at(-1).content[0].toolResult.status, 'error');
}));

test('a tool the server does not offer (such as confirming) is refused without any change', () => withCase(async (store, id) => {
  const model = scripted(use('confirm_dispute_action', { tenancyId }), say('I cannot confirm decisions for you.'));
  const session = await assistantTurn(store, id, { revision: 0, question: 'Confirm my dispute.' }, { settings, converse: model.converse });
  assert.equal(session.pending, null); assert.equal(session.records.history.filter(e => e.kind !== 'EVIDENCE_LINK').length, 0);
  assert.equal(model.requests[1].messages.at(-1).content[0].toolResult.status, 'error');
}));

test('claims of saving are corrected', () => withCase(async (store, id) => {
  const model = scripted(say('I have submitted your dispute to the landlord.'));
  const message = last(await assistantTurn(store, id, { revision: 0, question: 'What happens next?' }, { settings, converse: model.converse }));
  assert.match(message.text, /Nothing has been saved yet/);
}));

test('Bedrock failures and runaway tool loops fall back to rule mode visibly', () => quiet(() => withCase(async (store, id) => {
  const failing = scripted(Object.assign(new Error('The security token included in the request is invalid.'), { name: 'UnrecognizedClientException' }));
  let session = await assistantTurn(store, id, { revision: 0, question: 'Show evidence for the first deduction' }, { settings, converse: failing.converse });
  assert.equal(last(session).provider, 'rules'); assert.match(session.notice, /^Amazon Bedrock was unavailable/);
  const looping = scripted(use('get_settlement_context', { tenancyId }));
  session = await assistantTurn(store, id, { revision: session.revision, question: 'Show evidence for the first deduction' }, { settings, converse: looping.converse });
  assert.equal(looping.requests.length, 5); assert.equal(last(session).provider, 'rules');
})));

test('stale revisions and malformed input are rejected before any model call', () => withCase(async (store, id) => {
  const model = scripted(say('unused'));
  await assert.rejects(assistantTurn(store, id, { revision: 7, question: 'Show evidence' }, { settings, converse: model.converse }), /changed in another tab/);
  await assert.rejects(assistantTurn(store, id, { revision: 0, question: 'Hi', role: 'LANDLORD' }, { settings, converse: model.converse }), /Unsupported/);
  await assert.rejects(assistantTurn(store, id, { revision: 0, question: 'x'.repeat(601) }, { settings, converse: model.converse }), /1–600/);
  assert.equal(model.requests.length, 0);
}));

test('later questions include the recent conversation for this role', () => withCase(async (store, id) => {
  const first = scripted(say('The wall deduction is 100 ringgit [wall].'));
  let session = await assistantTurn(store, id, { revision: 0, question: 'How much is the wall deduction?' }, { settings, converse: first.converse });
  const second = scripted(say('It is still proposed [wall].'));
  session = await assistantTurn(store, id, { revision: session.revision, question: 'And is it disputed?' }, { settings, converse: second.converse });
  const texts = second.requests[0].messages.map(m => m.content[0].text);
  assert.deepEqual(texts, ['How much is the wall deduction?', 'The wall deduction is 100 ringgit [wall].', 'And is it disputed?']);
}));

test('Bedrock stays opt-in and validates its settings', () => {
  assert.equal(bedrockSettings({}), null);
  assert.deepEqual(bedrockSettings({ COMPANION_BEDROCK_MODEL: 'apac.amazon.nova-pro-v1:0', AWS_REGION: 'ap-southeast-1' }),
    { modelId: 'apac.amazon.nova-pro-v1:0', region: 'ap-southeast-1' });
  assert.equal(bedrockSettings({ COMPANION_BEDROCK_MODEL: 'amazon.nova-lite-v1:0' }).region, 'us-east-1');
  assert.throws(() => bedrockSettings({ COMPANION_BEDROCK_MODEL: 'bad model id' }), /not a valid/);
  assert.deepEqual(assistantMode({}), { mode: 'rules' });
  assert.deepEqual(assistantMode({ COMPANION_BEDROCK_MODEL: 'bad model id' }), { mode: 'rules' });
  assert.deepEqual(assistantMode({ COMPANION_BEDROCK_MODEL: 'amazon.nova-pro-v1:0' }), { mode: 'bedrock', model: 'amazon.nova-pro-v1:0' });
});

test('tool schemas are flattened into the JSON Schema subset Amazon Nova accepts', () => withCase(async (store, id) => {
  const model = scripted(say('The deposit is 1800 ringgit [judge-synthetic-tenancy].'));
  await assistantTurn(store, id, { revision: 0, question: 'What is the deposit?' }, { settings, converse: model.converse });
  const allowed = new Set(['type', 'properties', 'required']);
  for (const { toolSpec } of model.requests[0].toolConfig.tools) {
    assert.ok(Object.keys(toolSpec.inputSchema.json).every(key => allowed.has(key)), toolSpec.name);
    assert.ok(!JSON.stringify(toolSpec.inputSchema.json).match(/"(oneOf|anyOf|\$schema|additionalProperties)"/), toolSpec.name);
  }
  const prepare = model.requests[0].toolConfig.tools.find(t => t.toolSpec.name === 'prepare_dispute_action').toolSpec.inputSchema.json;
  const action = prepare.properties.action;
  assert.deepEqual(action.required, ['kind', 'payload']);
  assert.deepEqual(action.properties.kind.enum, ['DISPUTE', 'WITHDRAWAL', 'DEDUCTION_ACCEPTANCE', 'ADJUSTMENT', 'RESPONSE', 'ACCEPTANCE', 'REJECTION', 'ADJUSTMENT_ACCEPTANCE', 'ADJUSTMENT_REJECTION']);
  assert.deepEqual(Object.keys(action.properties.payload.properties).sort(), ['adjustmentId', 'amountSen', 'deductionId', 'disputeId', 'responseId', 'text']);
  assert.deepEqual(action.properties.payload.required, ['text'], 'only fields every branch needs stay required');
  assert.deepEqual(prepare.required, ['tenancyId', 'expectedRevision', 'action']);
  // Nova 1 models get greedy decoding; others get no model-specific fields.
  assert.deepEqual(model.requests[0].additionalModelRequestFields, { inferenceConfig: { topK: 1 } });
  assert.equal(model.requests[0].inferenceConfig.temperature, 0);
  const other = scripted(say('ok'));
  await assistantTurn(store, id, { revision: (await store.read(id)).revision, question: 'What is the deposit?' },
    { settings: { ...settings, modelId: 'global.amazon.nova-2-lite-v1:0' }, converse: other.converse });
  assert.equal(other.requests[0].additionalModelRequestFields, undefined);
  assert.deepEqual(modelToolSchema({ $schema: 'x', type: 'object', properties: {}, additionalProperties: false }), { type: 'object', properties: {} });
}));

test('Nova thinking notes are never shown or spoken; malformed tool use falls back', () => quiet(() => withCase(async (store, id) => {
  const model = scripted({ stopReason: 'end_turn', output: { message: { role: 'assistant', content: [
    { text: '<thinking>The user wants the move-in report.</thinking>The move-in report recorded a short scuff [move-in].' }] } } });
  const message = last(await assistantTurn(store, id, { revision: 0, question: 'Was it already there?' }, { settings, converse: model.converse }));
  assert.equal(message.text, 'The move-in report recorded a short scuff [move-in].');
  assert.ok(!message.speech.includes('thinking'));
  const broken = scripted({ stopReason: 'malformed_tool_use', output: { message: { role: 'assistant', content: [] } } });
  const session = await assistantTurn(store, id, { revision: (await store.read(id)).revision, question: 'Show evidence for the first deduction' }, { settings, converse: broken.converse });
  assert.equal(last(session).provider, 'rules');
})));

test('speech helpers read naturally', () => {
  assert.equal(spokenMoney(10000), '100 ringgit'); assert.equal(spokenMoney(2050), '20 ringgit 50 sen');
  assert.equal(speakable('See **this** [move-in] and [file:W01].'), 'See this and.');
  assert.match(speakable('A. '.repeat(400)), /The details are on screen\.$/);
});
