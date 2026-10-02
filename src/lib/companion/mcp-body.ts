import { MCP_LIMITS } from './mcp-limits';

export class McpBodyError extends Error {
  constructor(public readonly status: number, message: string, public readonly rpcCode = -32000) { super(message); }
}

// Bound both bytes and wall time; a stream that never ends cannot occupy a slot
// forever. Cancellation is deliberately not awaited: a bad stream may hang there.
export async function readMcpMessage(request: Request, timeoutMs: number = MCP_LIMITS.bodyTimeoutMs): Promise<unknown> {
  if (request.signal.aborted) throw new McpBodyError(408, 'Request cancelled. Nothing was saved.');
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new McpBodyError(415, 'Content-Type must be application/json.');
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))))
    throw new McpBodyError(400, 'Invalid Content-Length.');
  if (length !== null && Number(length) > MCP_LIMITS.bodyBytes)
    throw new McpBodyError(413, 'MCP message too large.');
  if (!request.body) throw new McpBodyError(400, 'JSON message required.', -32700);
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  let complete = false;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new McpBodyError(408, 'Request cancelled. Nothing was saved.'));
    request.signal.addEventListener('abort', onAbort, { once: true });
    if (request.signal.aborted) onAbort();
    timer = setTimeout(() => reject(new McpBodyError(408, 'Request body timed out. Nothing was saved.')), timeoutMs);
  });
  try {
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MCP_LIMITS.bodyBytes) throw new McpBodyError(413, 'MCP message too large.');
      chunks.push(value);
    }
    complete = true;
    let parsedBody: unknown;
    try { parsedBody = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new McpBodyError(400, 'Invalid JSON.', -32700); }
    // The SDK still accepts legacy batches, but the 2025-11-25 endpoint does not.
    if (Array.isArray(parsedBody)) throw new McpBodyError(400, 'Send one MCP message per request.', -32600);
    return parsedBody;
  } catch (error) {
    if (error instanceof McpBodyError) throw error;
    throw new McpBodyError(400, 'Could not read the MCP message.', -32700);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
