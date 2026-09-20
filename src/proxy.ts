import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
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
  // Cover dashboard routes + all API routes except NextAuth's own /api/auth/* endpoints
  matcher: ['/dashboard/:path*', '/api/((?!auth/).*)'],
};
