// パスワード保護のための共通処理
// パスワードそのものをCookieに保存しないよう、ハッシュ化（別の文字列に変換）してから比較する

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// アプリ全体の合言葉（クラウド公開時のみ有効）
export const AUTH_COOKIE_NAME = "vr_auth";

// 車両管理（管理者用機能）専用の合言葉
// 環境変数 ADMIN_PASSWORD が設定されていればそちらを使い、なければ既定値を使う
export const ADMIN_AUTH_COOKIE_NAME = "vr_admin_auth";
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "mIck3216";
}
