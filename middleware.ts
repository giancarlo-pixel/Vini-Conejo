import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isAuthCookieValid } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await isAuthCookieValid(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
