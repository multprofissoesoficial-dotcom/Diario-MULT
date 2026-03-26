import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get("user_role")?.value;
  const uid = request.cookies.get("user_uid")?.value;

  // Public routes
  if (pathname === "/" || pathname.startsWith("/api/auth")) {
    if (uid && role) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  if (!uid || !role) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Role-based protection
  if (pathname.startsWith("/admin") && role !== "master" && role !== "coordenador") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/teacher") && role !== "professor" && role !== "master") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
