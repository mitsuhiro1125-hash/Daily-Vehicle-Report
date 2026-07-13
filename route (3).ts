import { NextRequest, NextResponse } from "next/server";
import {
  hashText,
  AUTH_COOKIE_NAME,
  ADMIN_AUTH_COOKIE_NAME,
  getAdminPassword,
} from "@/lib/auth";

// すべてのページ・APIアクセスの前に実行され、パスワード保護を行う。
// APP_PASSWORD が設定されていない環境（ローカル開発など）では、全体の保護は何もしない。
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const expected = await hashText(appPassword);

    if (cookie !== expected) {
      // APIアクセスの場合はログイン画面へのリダイレクトではなく401を返す
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 車両の追加・編集・削除（GET以外）は、管理者パスワードでさらに保護する
  // 車両一覧の取得（GET）は日報・月報画面でも使うため保護しない
  const isVehicleWrite =
    pathname.startsWith("/api/vehicles") && request.method !== "GET";

  if (isVehicleWrite) {
    const adminCookie = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
    const expectedAdmin = await hashText(getAdminPassword());
    if (adminCookie !== expectedAdmin) {
      return NextResponse.json(
        { error: "管理者パスワードによる認証が必要です" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|login|api/login|api/admin/seed|api/admin-login).*)",
  ],
};
