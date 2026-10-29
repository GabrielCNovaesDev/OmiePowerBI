import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, podeAdministrar } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron");

  if (!req.auth && !isPublic) {
    const login = new URL("/login", req.nextUrl);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (req.auth && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (req.auth && pathname.startsWith("/admin") && !podeAdministrar(req.auth.user?.papel)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-url", req.nextUrl.href);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|logos/).*)"],
};
