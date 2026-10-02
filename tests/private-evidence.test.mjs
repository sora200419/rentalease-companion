import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const {validateEvidence,evidenceObjectName,validEvidenceObjectName,evidencePrefix,MAX_EVIDENCE_BYTES}=await import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT,'companion/private-evidence.js')).href);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=','base64');
test('private evidence rejects traversal, foreign fixtures, spoofed types, oversized and empty uploads',()=>{
  assert.throws(()=>evidencePrefix('real-tenancy','report'));
  for(const id of ['../private','report/other','%2e%2e','']) assert.throws(()=>evidencePrefix('fixture-a-tenancy',id));
  assert.throws(()=>validateEvidence(png,'application/pdf','image.pdf'));
  assert.throws(()=>validateEvidence(Buffer.from('<svg/>'),'image/svg+xml','image.svg'));
  assert.throws(()=>validateEvidence(Buffer.alloc(MAX_EVIDENCE_BYTES+1),'image/png','large.png'));
  assert.throws(()=>validateEvidence(Buffer.alloc(0),'image/png','empty.png'));
  assert.equal(validEvidenceObjectName('../x'),false);
});
test('content-addressed evidence preserves bytes, sanitizes filenames and makes retries deterministic',()=>{
  const original=Buffer.from(png);
  const info=validateEvidence(png,'image/png','../../unsafe name.png');
  const first=evidenceObjectName('fixture-a-tenant',info);
  assert.equal(first,evidenceObjectName('fixture-a-tenant',validateEvidence(png,'image/png','../../unsafe name.png')));
  assert.equal(validEvidenceObjectName(first),true);
  assert.ok(!info.name.includes('/'));
  assert.deepEqual(png,original);
  assert.throws(()=>evidenceObjectName('foreign-user',info));
  assert.notEqual(first,evidenceObjectName('fixture-a-landlord',info));
});
