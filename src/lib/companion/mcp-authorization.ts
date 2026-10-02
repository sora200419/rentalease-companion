import { jwtVerify, type JWTVerifyGetKey } from 'jose';

export const MCP_READ_SCOPE = 'rentalease:records:read';
export const MCP_PREVIEW_SCOPE = 'rentalease:records:preview';
export const MCP_SCOPES = Object.freeze([MCP_READ_SCOPE, MCP_PREVIEW_SCOPE]);

export class McpAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403 | 503, public readonly reason: 'missing_token' | 'invalid_token' | 'insufficient_scope' | 'access_denied' | 'unavailable') {
    super('Remote records access was not authorized.');
  }
}

export type McpAuthorizationPolicy = {
  issuer: string;
  resource: string;
  clientIds: readonly string[];
  algorithms: readonly ('RS256' | 'ES256')[];
  maxTokenLifetimeSeconds?: number;
};
export type McpAccountGrant = {
  issuer: string; subject: string; clientId: string; resource: string; accountId: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  revoked: boolean; validAfter: number; expiresAt: number; scopes: readonly string[];
};
export type McpIdentity = Readonly<{ issuer: string; subject: string; clientId: string; resource: string }>;
export type McpPrincipal = Readonly<{ actorId: string; scopes: readonly string[] }>;
export type McpAuthorizationServices = {
  // Must use operator-configured trusted keys. Never resolve a URL supplied in a token.
  resolveKey: JWTVerifyGetKey;
  // Both lookups are required, uncached, authoritative and fail closed.
  findGrant: (identity: McpIdentity) => Promise<McpAccountGrant | null>;
  isTokenRevoked: (identity: McpIdentity & { tokenId: string }) => Promise<boolean>;
};

export function requireHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href !== value)
    throw new Error('Use an exact canonical HTTPS URL without credentials, query or fragment.');
  return url;
}
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[\x21-\x7e]{1,200}$/.test(value);

// JWT access-token resource-server profile, not an OAuth server. Not wired to a
// Next route. Provider onboarding, consent and persistent grants remain separate.
export function createMcpAuthorizer(policy: McpAuthorizationPolicy, services: McpAuthorizationServices, clock = Date.now) {
  requireHttpsUrl(policy.issuer);
  requireHttpsUrl(policy.resource);
  const issuer = policy.issuer, resource = policy.resource;
  const clients = new Set(policy.clientIds);
  const algorithms = [...policy.algorithms];
  const lifetime = policy.maxTokenLifetimeSeconds ?? 3600;
  if (!clients.size || [...clients].some(id => !identifier(id)) || !algorithms.length ||
    algorithms.some(alg => !['RS256', 'ES256'].includes(alg)) || !Number.isSafeInteger(lifetime) || lifetime < 1 || lifetime > 3600)
    throw new Error('Explicit clients, asymmetric algorithms and a lifetime of at most one hour are required.');

  return async (request: Request): Promise<McpPrincipal> => {
    const authorization = request.headers.get('authorization');
    if (!authorization) throw new McpAuthorizationError(401, 'missing_token');
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
    if (!match || authorization.length > 8200) throw new McpAuthorizationError(401, 'invalid_token');
    let identity: McpIdentity, issuedAt: number, expiresAt: number, tokenId: string, scopes: string[];
    try {
      const { payload } = await jwtVerify(match[1], async (header, token) => {
        if (header.jku || header.x5u || header.jwk) throw new Error('Token-directed key selection is prohibited.');
        return services.resolveKey(header, token);
      }, {
        issuer, audience: resource, algorithms, typ: 'at+jwt', clockTolerance: 5,
        currentDate: new Date(clock()), maxTokenAge: lifetime,
        requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'jti', 'client_id', 'scope'],
      });
      issuedAt = payload.iat!; expiresAt = payload.exp!;
      if (payload.aud !== resource || !identifier(payload.sub) || !identifier(payload.client_id) || !identifier(payload.jti) ||
        !clients.has(payload.client_id) || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
        expiresAt <= issuedAt || expiresAt - issuedAt > lifetime ||
        typeof payload.scope !== 'string' || payload.scope.length > 2048 || !/^[A-Za-z0-9:._/-]+(?: [A-Za-z0-9:._/-]+)*$/.test(payload.scope))
        throw new Error('Invalid access-token profile.');
      identity = Object.freeze({ issuer, resource, subject: payload.sub, clientId: payload.client_id });
      tokenId = payload.jti;
      scopes = payload.scope.split(' ');
    } catch {
      throw new McpAuthorizationError(401, 'invalid_token');
    }
    let grant: McpAccountGrant | null, revoked: boolean;
    try {
      [grant, revoked] = await Promise.all([services.findGrant(identity), services.isTokenRevoked({ ...identity, tokenId })]);
    } catch {
      throw new McpAuthorizationError(503, 'unavailable');
    }
    const now = Math.floor(clock() / 1000);
    if (revoked !== false || expiresAt <= now) throw new McpAuthorizationError(401, 'invalid_token');
    if (!grant || grant.issuer !== issuer || grant.subject !== identity.subject || grant.clientId !== identity.clientId ||
      grant.resource !== resource || !identifier(grant.accountId) || grant.accountStatus !== 'ACTIVE' || grant.revoked !== false ||
      !Number.isSafeInteger(grant.validAfter) || grant.validAfter < 0 || issuedAt <= grant.validAfter ||
      !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt <= now || !Array.isArray(grant.scopes))
      throw new McpAuthorizationError(403, 'access_denied');
    const effective = MCP_SCOPES.filter(scope => scopes.includes(scope) && grant.scopes.includes(scope));
    if (!effective.includes(MCP_READ_SCOPE)) throw new McpAuthorizationError(403, 'insufficient_scope');
    // Email, role, account and tenancy claims are deliberately ignored.
    return Object.freeze({ actorId: grant.accountId, scopes: Object.freeze(effective) });
  };
}

export function protectedResourceMetadata(policy: McpAuthorizationPolicy) {
  requireHttpsUrl(policy.resource); requireHttpsUrl(policy.issuer);
  return { resource: policy.resource, authorization_servers: [policy.issuer],
    scopes_supported: [...MCP_SCOPES], bearer_methods_supported: ['header'] };
}

export function authorizationChallenge(policy: McpAuthorizationPolicy, error: McpAuthorizationError, scopes: readonly string[] = [MCP_READ_SCOPE]) {
  const resource = requireHttpsUrl(policy.resource);
  const metadata = `${resource.origin}/.well-known/oauth-protected-resource${resource.pathname === '/' ? '' : resource.pathname}`;
  // All header values come from validated configuration or fixed scope constants.
  if (scopes.some(scope => !MCP_SCOPES.includes(scope))) throw new Error('Unknown requested scope.');
  const code = ['invalid_token', 'insufficient_scope'].includes(error.reason) ? `, error="${error.reason}"` : '';
  return `Bearer resource_metadata="${metadata}", scope="${scopes.join(' ')}"${code}`;
}
