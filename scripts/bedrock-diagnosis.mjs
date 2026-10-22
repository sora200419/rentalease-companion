// Turns the failures collected by check-bedrock.mjs into one likely cause.
// Each failure is { modelId, region, name, message } as Bedrock reported it.

export const geographyPrefix = /^(?:apac|us|eu|global|apne1|us-gov)\./;
const invalidId = /provided model identifier is invalid/i;
const notAllowed = /operation not allowed/i;
// A timeout or throttle says nothing about whether the account may call the model.
const transient = /^(?:TimeoutError|AbortError|ThrottlingException|ServiceUnavailableException|ModelNotReadyException|InternalServerException)$/;

export function diagnoseBedrockFailures(failures) {
  // An id that does not exist in a region says nothing about the account.
  const real = failures.filter(f => !invalidId.test(f.message ?? '') && !transient.test(f.name ?? ''));
  if (real.some(f => f.name === 'UnrecognizedClientException')) return 'credentials';
  if (real.some(f => f.name === 'AccessDeniedException')) return 'access-denied';
  const models = new Set(real.map(f => f.modelId.replace(geographyPrefix, '')));
  // One retired model also answers "Operation not allowed"; several current
  // models refusing everywhere means the account itself is blocked.
  if (models.size >= 2 && real.every(f => notAllowed.test(f.message ?? ''))) return 'account-restricted';
  return 'unknown';
}
