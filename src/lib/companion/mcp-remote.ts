import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createRecordsMcpServer, type RecordsMcpServices } from './mcp-server';
import { McpBodyError, readMcpMessage } from './mcp-body';
import { createMcpLimits, MCP_LIMITS, type McpLimits } from './mcp-limits';
import { authorizationChallenge, McpAuthorizationError, MCP_PREVIEW_SCOPE, MCP_READ_SCOPE,
  protectedResourceMetadata, requireHttpsUrl, type McpAuthorizationPolicy, type McpPrincipal } from './mcp-authorization';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const failure = (status: number, message: string, extra = {}, code = -32000) =>
  Response.json({ jsonrpc: '2.0', id: null, error: { code, message } }, { status, headers: { ...headers, ...extra } });

// Deliberately not imported by a Next route. This factory is exercised with
// synthetic in-process HTTPS Requests; it does not listen on a network port.
export function createRemoteMcpHandler(options: {
  enabled?: boolean;
  policy: McpAuthorizationPolicy;
  authenticate: (request: Request) => Promise<McpPrincipal>;
  services: RecordsMcpServices;
  limits?: McpLimits;
}) {
  const policy = { ...options.policy, clientIds: [...options.policy.clientIds], algorithms: [...options.policy.algorithms] };
  const enabled = options.enabled === true;
  const endpoint = requireHttpsUrl(policy.resource);
  const metadataPath = `/.well-known/oauth-protected-resource${endpoint.pathname === '/' ? '' : endpoint.pathname}`;
  const metadata = protectedResourceMetadata(policy);
  const limits = options.limits ?? createMcpLimits();
  return async (request: Request): Promise<Response> => {
    if (!enabled) return new Response(null, { status: 404, headers });
    const url = new URL(request.url), origin = request.headers.get('origin');
    if (url.origin !== endpoint.origin || request.headers.get('host') !== endpoint.host ||
      (origin !== null && origin !== endpoint.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
      return failure(403, 'Connection not allowed.');
    if (url.search) return failure(400, 'Query parameters are not accepted.');
    if (url.pathname === metadataPath) return request.method === 'GET'
      ? Response.json(metadata, { headers }) : new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } });
    if (url.pathname !== endpoint.pathname) return new Response(null, { status: 404, headers });
    // A remote identity may never fall back to an ambient browser cookie.
    if (request.headers.has('cookie')) return failure(400, 'Use a dedicated bearer-token client without browser cookies.');
    const requestLease = limits.enterRequest();
    if (!requestLease.ok) return failure(requestLease.status, 'Records service busy.', { 'Retry-After': String(requestLease.retryAfter) });
    let releaseAccount: (() => void) | undefined;
    let server: ReturnType<typeof createRecordsMcpServer> | undefined;
    try {
      const principal = await options.authenticate(request);
      if (!principal.scopes.includes(MCP_READ_SCOPE)) throw new McpAuthorizationError(403, 'insufficient_scope');
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
      const accountLease = limits.enterAccount(principal.actorId);
      if (!accountLease.ok) return failure(accountLease.status, 'Too many records requests.', { 'Retry-After': String(accountLease.retryAfter) });
      releaseAccount = accountLease.release;
      const parsedBody = await readMcpMessage(request);
      const preview = principal.scopes.includes(MCP_PREVIEW_SCOPE);
      if (parsedBody && typeof parsedBody === 'object' && 'method' in parsedBody && parsedBody.method === 'tools/call' &&
        'params' in parsedBody && parsedBody.params && typeof parsedBody.params === 'object' &&
        'name' in parsedBody.params && parsedBody.params.name === 'prepare_dispute_action' && !preview) {
        const error = new McpAuthorizationError(403, 'insufficient_scope');
        return failure(403, 'Additional permission is required for previews.', {
          'WWW-Authenticate': authorizationChallenge(policy, error, [MCP_READ_SCOPE, MCP_PREVIEW_SCOPE]),
        });
      }
      if (request.signal.aborted) return failure(408, 'Request cancelled. Nothing was saved.');
      server = createRecordsMcpServer(principal.actorId, options.services, { preview });
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: MCP_LIMITS.bodyBytes,
      });
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody });
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      return response;
    } catch (error) {
      if (error instanceof McpAuthorizationError) return failure(error.status,
        error.status === 503 ? 'Authorization service unavailable.' : 'Remote records access was not authorized.',
        error.status === 503 ? {} : { 'WWW-Authenticate': authorizationChallenge(policy, error) });
      if (error instanceof McpBodyError) return failure(error.status, error.message, {}, error.rpcCode);
      return failure(503, 'Records service unavailable.');
    } finally {
      try { await server?.close(); }
      finally { releaseAccount?.(); requestLease.release(); }
    }
  };
}
