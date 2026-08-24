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
export const ADMIN_AUTH_COOKIE_NAME = "vr_admin_auth";
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "mIck3216";
}

// ログイン状態を保持する期間（秒）
// iPhoneのホーム画面アプリは、一定期間開かないとブラウザ側の保存領域が
// 消えることがあるため、Cookie自体の有効期限はできるだけ長く設定しておく。
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 365日
