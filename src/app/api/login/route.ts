import { NextRequest, NextResponse } from "next/server";
import { hashText, AUTH_COOKIE_NAME } from "@/lib/auth";

// POST /api/login : 共有パスワードを照合し、正しければCookieを発行する
export async function POST(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;

  // APP_PASSWORDが設定されていない場合（ローカル開発など）は保護なしとして扱う
  if (!appPassword) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== appPassword) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = await hashText(appPassword);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日間
  });
  return res;
}
