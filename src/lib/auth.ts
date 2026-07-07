// パスワード保護のための共通処理
// パスワードそのものをCookieに保存しないよう、ハッシュ化（別の文字列に変換）してから比較する

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const AUTH_COOKIE_NAME = "vr_auth";
