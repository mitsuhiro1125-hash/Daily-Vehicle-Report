"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 共有パスワードを入力してもらうログイン画面
// APP_PASSWORD が設定されている環境（クラウド公開時など）でのみ表示される
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "パスワードが正しくありません");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-5"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-800 mb-1">車両月報作成アプリ</h1>
          <p className="text-gray-500 text-sm">パスワードを入力してください</p>
        </div>

        {error && (
          <p className="text-red-600 font-bold bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div>
          <input
            type="password"
            autoFocus
            className="input-field"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "確認中..." : "入る"}
        </button>
      </form>
    </main>
  );
}
