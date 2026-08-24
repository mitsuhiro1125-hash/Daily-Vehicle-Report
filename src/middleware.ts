import { NextRequest, NextResponse } from "next/server";
import {
  hashText,
  AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_NAME,
  getAdminPassword,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const expected = await hashText(appPassword);

    if (cookie !== expected) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const isAdminWrite =
    (pathname.startsWith("/api/vehicles") || pathname.startsWith("/api/departments")) &&
    request.method !== "GET";

  if (isAdminWrite) {
    const adminCookie = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
    const expectedAdmin = await hashText(getAdminPassword());
    if (adminCookie !== expectedAdmin) {
      return NextResponse.json({ error: "管理者パスワードによる認証が必要です" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|login|api/login|api/admin/seed|api/admin-login).*)",
  ],
};
