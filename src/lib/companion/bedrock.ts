import type { Converse } from './assistant';

// Amazon Bedrock is opt-in. Without COMPANION_BEDROCK_MODEL the demo keeps its
// credential-free rule mode. Credentials come from the standard AWS chain
// (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, AWS_PROFILE, ...) or a Bedrock API
// key in AWS_BEARER_TOKEN_BEDROCK; they are never sent to the browser.
export type BedrockSettings = { modelId: string; region: string; endpoint?: string };

export function bedrockSettings(env: Record<string, string | undefined> = process.env): BedrockSettings | null {
  const modelId = env.COMPANION_BEDROCK_MODEL?.trim();
  if (!modelId) return null;
  if (!/^[a-zA-Z0-9._:/-]{3,200}$/.test(modelId)) throw new Error('COMPANION_BEDROCK_MODEL is not a valid model or inference profile id.');
  const region = (env.COMPANION_BEDROCK_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1').trim();
  const endpoint = env.COMPANION_BEDROCK_ENDPOINT?.trim() || undefined;
  return { modelId, region, ...(endpoint ? { endpoint } : {}) };
}

const clients = new Map<string, Promise<Converse>>();
export function bedrockConverse(settings: BedrockSettings): Promise<Converse> {
  const key = settings.region + '|' + (settings.endpoint ?? '');
  let client = clients.get(key);
  if (!client) {
    client = (async () => {
      // Loaded lazily so rule mode never initialises the AWS SDK.
      const { BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime');
      const runtime = new BedrockRuntimeClient({ region: settings.region, maxAttempts: 2, ...(settings.endpoint ? { endpoint: settings.endpoint } : {}) });
      const converse: Converse = async (request, signal) => {
        const output = await runtime.send(new ConverseCommand(request as ConstructorParameters<typeof ConverseCommand>[0]), { abortSignal: signal });
        return output as Awaited<ReturnType<Converse>>;
      };
      return converse;
    })();
    clients.set(key, client);
    client.catch(() => clients.delete(key));
  }
  return client;
}
