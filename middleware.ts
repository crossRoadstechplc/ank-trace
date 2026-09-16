import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let session = null;
  if (token && process.env.AUTH_SECRET) {
    session = await verifySessionToken(token);
  }

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (session) {
      return NextResponse.redirect(new URL("/select-role", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/select-role") {
    if (!session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
