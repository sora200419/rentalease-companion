import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseBedrockFailures } from '../scripts/bedrock-diagnosis.mjs';

const denied = (modelId, region) => ({ modelId, region, name: 'ValidationException', message: 'Operation not allowed' });
const invalid = (modelId, region) => ({ modelId, region, name: 'ValidationException', message: 'The provided model identifier is invalid.' });

// A run where the key was valid but the account was blocked: every existing model
// refused, and ids that do not exist were rejected as invalid.
test('every current model refusing everywhere is reported as an account restriction', () => {
  const failures = [
    denied('apac.amazon.nova-pro-v1:0', 'ap-southeast-1'),
    denied('us.amazon.nova-pro-v1:0', 'us-east-1'),
    invalid('global.amazon.nova-pro-v1:0', 'us-east-1'),
    invalid('apac.amazon.nova-2-lite-v1:0', 'ap-southeast-1'),
    denied('global.amazon.nova-2-lite-v1:0', 'us-east-1'),
    denied('amazon.nova-lite-v1:0', 'ap-southeast-1'),
    denied('us.amazon.nova-micro-v1:0', 'us-west-2'),
  ];
  assert.equal(diagnoseBedrockFailures(failures), 'account-restricted');
});

test('a timeout or throttle does not hide an account restriction', () => {
  const failures = [
    denied('amazon.nova-lite-v1:0', 'ap-southeast-1'),
    denied('amazon.nova-micro-v1:0', 'ap-southeast-1'),
    { modelId: 'us.amazon.nova-pro-v1:0', region: 'us-east-1', name: 'TimeoutError', message: 'The operation was aborted due to timeout' },
    { modelId: 'us.amazon.nova-lite-v1:0', region: 'us-east-1', name: 'ThrottlingException', message: 'Too many requests' },
  ];
  assert.equal(diagnoseBedrockFailures(failures), 'account-restricted');
});

test('a single model refusing may just be retired, so the account is not blamed', () => {
  const failures = [denied('apac.amazon.nova-pro-v1:0', 'ap-southeast-1'), denied('us.amazon.nova-pro-v1:0', 'us-east-1')];
  assert.equal(diagnoseBedrockFailures(failures), 'unknown');
});

test('mixed reasons are not reported as an account restriction', () => {
  const failures = [
    denied('apac.amazon.nova-pro-v1:0', 'ap-southeast-1'),
    denied('amazon.nova-micro-v1:0', 'ap-southeast-1'),
    { modelId: 'amazon.nova-lite-v1:0', region: 'ap-southeast-1', name: 'ValidationException', message: 'Malformed input request' },
  ];
  assert.equal(diagnoseBedrockFailures(failures), 'unknown');
});

test('only invalid ids is not an account restriction', () => {
  assert.equal(diagnoseBedrockFailures([invalid('a.b-v1:0', 'us-east-1'), invalid('c.d-v1:0', 'us-east-1')]), 'unknown');
});

test('credential and IAM failures win over the account diagnosis', () => {
  assert.equal(diagnoseBedrockFailures([
    denied('amazon.nova-lite-v1:0', 'us-east-1'),
    { modelId: 'amazon.nova-micro-v1:0', region: 'us-east-1', name: 'UnrecognizedClientException', message: 'The security token included in the request is invalid.' },
  ]), 'credentials');
  assert.equal(diagnoseBedrockFailures([
    denied('amazon.nova-lite-v1:0', 'us-east-1'),
    { modelId: 'amazon.nova-micro-v1:0', region: 'us-east-1', name: 'AccessDeniedException', message: 'not authorized to perform bedrock:InvokeModel' },
  ]), 'access-denied');
});
