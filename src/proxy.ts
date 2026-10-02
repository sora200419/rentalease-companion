import { withAuth } from 'next-auth/middleware';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';

const authenticatedProxy = withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role = token?.role;
    const isApiRoute = pathname.startsWith('/api/');

    // Block suspended users from both dashboard navigation and API calls
    if (token?.isSuspended === true) {
      if (isApiRoute) {
        return new NextResponse(
          JSON.stringify({ error: 'Your account has been suspended.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return NextResponse.redirect(new URL('/login?reason=suspended', req.url));
    }

    // API routes: suspension check above is the only concern; pass through
    if (isApiRoute) {
      return NextResponse.next();
    }

    // ADMIN users go to their own dashboard; block them from landlord/tenant routes
    if (role === 'ADMIN') {
      if (!pathname.startsWith('/dashboard/admin')) {
        return NextResponse.redirect(new URL('/dashboard/admin', req.url));
      }
      return NextResponse.next();
    }

    // Block non-admins from accessing the admin dashboard
    if (pathname.startsWith('/dashboard/admin')) {
      const fallback = role === 'LANDLORD' ? '/dashboard/landlord' : '/dashboard/tenant';
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    if (pathname.startsWith('/dashboard/landlord') && role !== 'LANDLORD') {
      return NextResponse.redirect(new URL('/dashboard/tenant', req.url));
    }

    if (pathname.startsWith('/dashboard/tenant') && role !== 'TENANT') {
      return NextResponse.redirect(new URL('/dashboard/landlord', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // API routes handle their own authentication — always pass through so
        // unauthenticated API calls get a proper 401 from the route handler.
        if (req.nextUrl.pathname.startsWith('/api/')) return true;
        // Dashboard routes require a valid session.
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  },
);

export const config = {
  // Include auth endpoints so the offline mode can block all backend requests.
  matcher: ['/dashboard/:path*', '/api/:path*'],
};

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (process.env.COMPANION_RECORDS_MODE === '1') {
    if (req.headers.get('host') !== '127.0.0.1:3031' || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Local access only.' }, { status: 403 });
    // MCP validates Origin when supplied, including GET, and authenticates every request.
    // Native MCP clients do not necessarily send an Origin header.
    if (req.nextUrl.pathname === '/api/mcp') return NextResponse.next();
    if (req.method !== 'GET' && req.headers.get('origin') !== 'http://127.0.0.1:3031') return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403 });
    if (/^\/api\/auth\/(csrf|session|providers|signin|signout|callback\/credentials)$/.test(req.nextUrl.pathname) || /^\/api\/records(?:\/[a-zA-Z0-9-]+(?:\/(question|actions|evidence|summary))?)?$/.test(req.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.json({ error: 'Only scoped records APIs are enabled in this mode.' }, { status: 503 });
  }
  if (process.env.COMPANION_OFFLINE_DEMO === '1') {
    if (/^\/api\/judge\/(session|start|resume|role|select|prepare|confirm|cancel|chat|photo)$/.test(req.nextUrl.pathname)) return NextResponse.next();
    if (/^\/api\/companion\/(session|resume|role|reset|prepare|confirm|cancel|chat)$/.test(req.nextUrl.pathname)) return NextResponse.next();
    return NextResponse.json({ error: 'Backend services are disabled in the offline companion demo.' }, { status: 503 });
  }
  if (req.nextUrl.pathname === '/api/auth' || req.nextUrl.pathname.startsWith('/api/auth/')) return NextResponse.next();
  return (authenticatedProxy as (req: NextRequest, event: NextFetchEvent) => ReturnType<typeof authenticatedProxy>)(req, event);
}
