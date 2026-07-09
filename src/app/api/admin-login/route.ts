import { NextRequest, NextResponse } from "next/server";
import { hashText, ADMIN_AUTH_COOKIE_NAME, getAdminPassword } from "@/lib/auth";

// GET /api/admin-login : 現在、管理者としてログイン済みかどうかを確認する
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
  const expected = await hashText(getAdminPassword());
  return NextResponse.json({ authenticated: cookie === expected });
}

// POST /api/admin-login : 管理者パスワードを照合し、正しければCookieを発行する
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== getAdminPassword()) {
    return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 401 });
  }

  const token = await hashText(getAdminPassword());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日間
  });
  return res;
}
