import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { hasAppAccess } from "@/lib/roles";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthRoute = nextUrl.pathname.startsWith("/sign-in");
  const isPublic =
    nextUrl.pathname === "/" ||
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname.startsWith("/api/external") ||
    nextUrl.pathname.startsWith("/api/v1") ||
    nextUrl.pathname.startsWith("/.well-known") ||
    nextUrl.pathname.startsWith("/api/oauth") ||
    nextUrl.pathname.startsWith("/api/mcp") ||
    nextUrl.pathname.startsWith("/oauth/authorize") ||
    nextUrl.pathname.startsWith("/unsubscribe") ||
    nextUrl.pathname.startsWith("/signup") ||
    nextUrl.pathname.startsWith("/register") ||
    nextUrl.pathname.startsWith("/invite/") ||
    nextUrl.pathname.startsWith("/forgot-password") ||
    nextUrl.pathname.startsWith("/reset/") ||
    nextUrl.pathname === "/login" ||
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/favicon");

  // Registered/SSO accounts with no assigned role (PENDING) are held on /pending.
  const role = (req.auth?.user as { role?: string } | undefined)?.role;
  const isPendingUser = isLoggedIn && !hasAppAccess(role);
  const onPending = nextUrl.pathname === "/pending";

  if (isAuthRoute) {
    if (isLoggedIn)
      return NextResponse.redirect(new URL(isPendingUser ? "/pending" : "/dashboard", nextUrl));
    return NextResponse.next();
  }
  if (!isLoggedIn && !isPublic) {
    const url = new URL("/sign-in", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  // Pending accounts can reach nothing but the holding screen (and public/auth
  // routes, so they can still sign out).
  if (isPendingUser && !onPending && !isPublic) {
    return NextResponse.redirect(new URL("/pending", nextUrl));
  }
  // A real account should never sit on the holding screen.
  if (isLoggedIn && !isPendingUser && onPending) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
