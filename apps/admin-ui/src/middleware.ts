import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware for auth protection.
 *
 * Checks for the presence of a Better Auth session cookie.
 * This doesn't validate the session (that happens server-side),
 * but it prevents unauthenticated users from hitting dashboard
 * routes at all — they get redirected to /login at the edge.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  const isAuthenticated = !!sessionCookie?.value;

  // Protected routes: everything under /users and the dashboard
  const isProtectedRoute =
    pathname.startsWith("/users") || pathname === "/";

  // Auth routes: /login
  const isAuthRoute = pathname.startsWith("/login");

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  if (isAuthRoute && isAuthenticated) {
    const usersUrl = new URL("/users", request.url);
    return NextResponse.redirect(usersUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api routes (Better Auth needs these)
     * - _next (Next.js internals)
     * - static files
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
