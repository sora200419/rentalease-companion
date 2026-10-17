import { readFileSync } from 'node:fs';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

// Reads .env.local the way `next dev` does, then sends the smallest possible
// Converse request so Amazon Bedrock's own rejection reason is visible. No
// credential value is ever printed: only whether one was found.
for (const file of ['.env.local', '.env']) {
  let contents;
  try { contents = readFileSync(new URL('../' + file, import.meta.url), 'utf8'); } catch { continue; }
  // Windows line endings and an editor's byte order mark must not hide a variable.
  for (const line of contents.replace(/^﻿/, '').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const value = match[2].trim().replace(/\s+#.*$/, '').replace(/^(['"])(.*)\1$/s, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const configuredModel = process.env.COMPANION_BEDROCK_MODEL?.trim();
const configuredRegion = (process.env.COMPANION_BEDROCK_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1').trim();
if (!configuredModel) {
  console.error('COMPANION_BEDROCK_MODEL is not set. Add it to .env.local before running this check.');
  process.exit(1);
}
const credential = process.env.AWS_BEARER_TOKEN_BEDROCK ? 'AWS_BEARER_TOKEN_BEDROCK'
  : process.env.AWS_ACCESS_KEY_ID ? 'AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY'
  : process.env.AWS_PROFILE ? 'AWS_PROFILE=' + process.env.AWS_PROFILE : null;
console.log('Configured model:  ' + configuredModel);
console.log('Configured region: ' + configuredRegion);
console.log('Credential source: ' + (credential ?? 'none found — Bedrock cannot be called'));
console.log('');

// A cross-region inference profile only works from its own geography, so each
// candidate pairs a prefix with the regions that accept it.
const base = configuredModel.replace(/^(?:apac|us|eu|global|apne1|us-gov)\./, '');
const geographies = [
  ['apac.', ['ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1']],
  ['us.', ['us-east-1', 'us-west-2']],
  ['global.', ['us-east-1']],
  ['', [configuredRegion]],
];
// A retired model answers "Operation not allowed", so current models are tried too.
const alternatives = ['amazon.nova-2-lite-v1:0', 'amazon.nova-lite-v1:0', 'amazon.nova-micro-v1:0'];
const candidates = [{ modelId: configuredModel, region: configuredRegion }];
for (const name of [base, ...alternatives.filter(a => a !== base)])
  for (const [prefix, regions] of geographies)
    for (const region of regions)
      if (!candidates.some(c => c.modelId === prefix + name && c.region === region))
        candidates.push({ modelId: prefix + name, region });

const request = { messages: [{ role: 'user', content: [{ text: 'Reply with the single word: ready.' }] }], inferenceConfig: { maxTokens: 16 } };
const working = [];
for (const candidate of candidates) {
  const client = new BedrockRuntimeClient({ region: candidate.region, maxAttempts: 1 });
  const label = candidate.region.padEnd(15) + ' ' + candidate.modelId;
  try {
    const output = await client.send(new ConverseCommand({ ...request, modelId: candidate.modelId }),
      { abortSignal: AbortSignal.timeout(30000) });
    console.log('OK    ' + label + '  → “' + (output.output?.message?.content?.[0]?.text ?? '').trim() + '”');
    working.push(candidate);
  } catch (error) {
    console.log('FAIL  ' + label + '  → ' + (error?.name ?? 'Error') + ': ' + (error?.message ?? ''));
  } finally {
    client.destroy();
  }
  // One working combination is enough; further calls would only add cost.
  if (working.length) break;
}

console.log('');
if (!working.length) {
  console.log('No combination worked. The message above is Amazon Bedrock’s own reason; common causes:');
  console.log('  UnrecognizedClientException — the API key is wrong, expired, or belongs to another account.');
  console.log('  AccessDeniedException       — an IAM policy or service control policy denies bedrock:InvokeModel.');
  console.log('  “Operation not allowed”     — the model is retired, or the key does not cover this inference profile.');
  console.log('Open the Bedrock console in this region → Model catalog, and use an id listed there.');
  process.exitCode = 1;
} else if (working[0].modelId === configuredModel && working[0].region === configuredRegion) {
  console.log('Your current .env.local settings work. Restart the dev server if the page still shows rule mode.');
} else {
  console.log('Put these two lines in .env.local, then restart the dev server:');
  console.log('  COMPANION_BEDROCK_MODEL=' + working[0].modelId);
  console.log('  COMPANION_BEDROCK_REGION=' + working[0].region);
}
