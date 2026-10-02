import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { parseAction, validateAction, prepareActionToken, verifyActionToken } = await import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion/records-actions.js')).href);
const secret = 'test-only-secret-not-used-outside-unit-tests';
const report = { kind: 'REPORT', payload: { reportType: 'MOVE_OUT', text: 'Synthetic report notes.' } };
const records = { tenancyId: 'fixture-a-tenancy', role: 'TENANT', history: [], settlement: { status: 'PROPOSED', deductions: [{ id: 'deduction-a', status: 'PROPOSED' }] } };
test('action parser allows only the requested content, not actor or financial fields', () => {
  assert.deepEqual(parseAction(report), report);
  for (const bad of [{ ...report, actorId: 'someone' }, { ...report, payload: { ...report.payload, amount: 1 } }, { ...report, payload: { ...report.payload, text: 'short' } }, { ...report, payload: { ...report.payload, text: 'x'.repeat(2001) } }, { kind: 'PAY', payload: report.payload }, null]) assert.throws(() => parseAction(bad));
});
test('confirmation binds content, actor, tenancy and revision with a signature', () => {
  const prepared = prepareActionToken(report, 'tenant-a','fixture-a-tenancy',3,secret,1000);
  const verified = verifyActionToken(prepared.token,'tenant-a','fixture-a-tenancy',secret,2000);
  assert.deepEqual(verified.payload,report.payload); assert.equal(verified.revision,3);
  assert.throws(() => verifyActionToken(prepared.token,'landlord-a','fixture-a-tenancy',secret,2000));
  assert.throws(() => verifyActionToken(prepared.token,'tenant-a','fixture-b-tenancy',secret,2000));
  const [body,sig] = prepared.token.split('.'); const changed = JSON.parse(Buffer.from(body,'base64url').toString()); changed.payload.text='Forged content from another request';
  assert.throws(() => verifyActionToken(Buffer.from(JSON.stringify(changed)).toString('base64url')+'.'+sig,'tenant-a','fixture-a-tenancy',secret,2000));
});
test('expired, malformed and differently signed confirmations are rejected', () => {
  const { token } = prepareActionToken(report,'a','fixture-a-tenancy',0,secret,1000);
  assert.throws(() => verifyActionToken(token,'a','fixture-a-tenancy',secret,601000));
  assert.throws(() => verifyActionToken(token,'a','fixture-a-tenancy','another-strong-secret-of-more-than-32-characters',2000));
  for (const value of ['', 'broken.token.extra', 'a'.repeat(14001)]) assert.throws(() => verifyActionToken(value,'a','fixture-a-tenancy',secret,2000));
});
test('disputes require the owning tenant and an open proposed deduction', () => {
  const action = { kind:'DISPUTE', payload:{ text:'Dispute with supporting records.', deductionId:'deduction-a' } };
  validateAction(records,action);
  assert.throws(() => validateAction({ ...records, role:'LANDLORD' },action));
  for (const status of ['PAID','AGREED']) assert.throws(() => validateAction({ ...records, settlement:{ ...records.settlement,status } },action));
  assert.throws(() => validateAction(records,{ ...action,payload:{ ...action.payload,deductionId:'other' } }));
});
test('responses require a landlord and an existing dispute; production tenancies are blocked', () => {
  const action = { kind:'RESPONSE',payload:{ text:'Landlord response text.',disputeId:'event-a' } };
  const landlord = { ...records,role:'LANDLORD',settlement:{status:'DISPUTED',deductions:[{id:'deduction-a',status:'DISPUTED'}]},history:[{ id:'event-a',kind:'DISPUTE',payload:{deductionId:'deduction-a'} }] };
  validateAction(landlord,action);
  assert.throws(() => validateAction(records,action));
  assert.throws(() => validateAction({ ...landlord,history:[] },action));
  assert.throws(() => validateAction({ ...records,tenancyId:'real-tenancy' },report));
});

test('tenant acceptance is explicit, tied to an existing landlord response, and one-time', () => {
  const dispute = { id:'dispute-a',kind:'DISPUTE',payload:{text:'Tenant dispute detail.',deductionId:'deduction-a'} };
  const response = { id:'response-a',kind:'RESPONSE',payload:{text:'Landlord review response.',disputeId:'dispute-a'} };
  const action = { kind:'ACCEPTANCE',payload:{text:'I accept this landlord response.',responseId:'response-a'} };
  assert.deepEqual(parseAction(action),action);
  const tenant = { tenancyId:'fixture-a-tenancy',role:'TENANT',settlement:{status:'DISPUTED',deductions:[{id:'deduction-a',status:'DISPUTED'}]},history:[dispute,response] };
  validateAction(tenant,action);
  assert.throws(() => validateAction({...tenant,role:'LANDLORD'},action));
  assert.throws(() => validateAction({...tenant,history:[dispute]},action));
  assert.throws(() => validateAction({...tenant,history:[dispute,response,{id:'accepted',kind:'ACCEPTANCE',payload:{responseId:'response-a'}}]},action));
  assert.throws(() => parseAction({...action,payload:{...action.payload,text:'Please accept it.'}}));
  assert.throws(() => validateAction({...tenant,settlement:{status:'AGREED',deductions:[{id:'deduction-a',status:'ACCEPTED'}]}},action));
  assert.throws(() => validateAction({...tenant,history:[dispute,{...response,revision:1},{...response,id:'new-response',revision:2}]},action));
});
