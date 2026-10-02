import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const MCP_CLIENT_TIMEOUT_MS = 20000;

// A complete initialize + tool call has one deadline. No automatic operation
// retry, credentials in tool arguments, or redirects to a different destination.
export async function callLocalMcpTool(name: string, args: Record<string, unknown>, origin: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {}) {
  const deadline = new AbortController();
  const timeoutMs = options.timeoutMs ?? MCP_CLIENT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A positive request deadline is required.');
  const endpoint = new URL('/api/mcp', origin);
  const timeoutError = new Error('The records request took too long. Nothing was saved. Refresh access and try again.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(timeoutError); deadline.abort(); }, timeoutMs);
  });
  const client = new Client({ name: 'rentalease-web', version: '0.1.0' });
  const send = options.fetch ?? fetch;
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { credentials: 'same-origin', cache: 'no-store', redirect: 'error' },
    fetch: (input, init) => {
      if (deadline.signal.aborted) return Promise.reject(timeoutError);
      return send(input, { ...init, signal: init?.signal
        ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal });
    },
  });
  try {
    return await Promise.race([expired, (async () => {
      await client.connect(transport, { signal: deadline.signal, timeout: timeoutMs });
      if (deadline.signal.aborted) throw timeoutError;
      const result = await client.callTool({ name, arguments: args }, undefined, { signal: deadline.signal, timeout: timeoutMs });
      if (result.isError || !result.structuredContent || typeof result.structuredContent !== 'object' || Array.isArray(result.structuredContent)) {
        const content = result.content as { type: string; text?: string }[];
        throw new Error(content.find(item => item.type === 'text')?.text ?? 'Could not retrieve current records.');
      }
      return result.structuredContent as Record<string, unknown>;
    })()]);
  } catch (error) {
    if (deadline.signal.aborted) throw timeoutError;
    if (error instanceof StreamableHTTPError) {
      if (error.code === 401) throw new Error('Your access could not be verified. Refresh access or sign in again. Nothing was saved.');
      if (error.code === 403) throw new Error('This connection is not allowed. Open the local records workspace and sign in again.');
      if (error.code === 429) throw new Error('Too many requests at once. Wait a moment before trying again. Nothing was saved.');
      if (error.code === 408) throw timeoutError;
      if (error.code === 503) throw new Error('The records service is busy or temporarily unavailable. Wait a moment and try again. Nothing was saved.');
      throw new Error('The records connection is unavailable. Refresh access and try again. Nothing was saved.');
    }
    if (error instanceof TypeError) throw new Error('Could not connect to the records workspace. Check the local server and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    deadline.abort();
    await client.close();
  }
}
