import { NextRequest, NextResponse } from "next/server";
import { hashText, AUTH_COOKIE_NAME } from "@/lib/auth";

// すべてのページ・APIアクセスの前に実行され、パスワード保護を行う。
// APP_PASSWORD が設定されていない環境（ローカル開発など）では何もしない。
export async function middleware(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expected = await hashText(appPassword);

  if (cookie === expected) {
    return NextResponse.next();
  }

  // APIアクセスの場合はログイン画面へのリダイレクトではなく401を返す
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|login|api/login|api/admin/seed).*)",
  ],
};
