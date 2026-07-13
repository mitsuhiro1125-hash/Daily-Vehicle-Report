"use client";

import { useEffect, useState, type FormEvent } from "react";
import PageHeader from "@/components/PageHeader";
import type { VehicleDTO } from "@/lib/types";

type FormState = {
  id: number | null;
  name: string;
  number: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  number: "",
  sortOrder: "0",
  isActive: true,
};

const NETWORK_ERROR_MESSAGE =
  "通信エラーが発生しました。電波・Wi-Fiの状態を確認して、もう一度お試しください。";

export default function VehiclesPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authCheckError, setAuthCheckError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reviveError, setReviveError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      setAuthCheckError(null);
      try {
        const res = await fetch("/api/admin-login");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setAuthenticated(!!data.authenticated);
      } catch {
        setAuthCheckError(NETWORK_ERROR_MESSAGE);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error ?? "パスワードが正しくありません");
        return;
      }
      setAuthenticated(true);
      setAdminPassword("");
    } catch {
      setAuthError(NETWORK_ERROR_MESSAGE);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/vehicles?includeInactive=1");
      if (!res.ok) throw new Error("failed");
      const data: VehicleDTO[] = await res.json();
      setVehicles(data);
    } catch {
      setLoadError(NETWORK_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) {
      load();
    }
  }, [authenticated]);

  function startEdit(v: VehicleDTO) {
    setForm({
      id: v.id,
      name: v.name,
      number: v.number,
      sortOrder: String(v.sortOrder),
      isActive: v.isActive,
    });
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setErrorMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!form.name.trim() || !form.number.trim()) {
      setErrorMessage("車両名と車両番号は必須です");
      return;
    }

    const payload = {
      name: form.name.trim(),
      number: form.number.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      const res = form.id
        ? await fetch(`/api/vehicles/${form.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/vehicles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error ?? "保存に失敗しました");
        return;
      }

      resetForm();
      load();
    } catch {
      setErrorMessage(NETWORK_ERROR_MESSAGE);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/vehicles/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeleteError(data.error ?? "削除に失敗しました");
        return;
      }

      setDeleteTarget(null);
      if (data.hidden) {
        setInfoMessage(data.message ?? "利用記録があるため、非表示（使用停止）にしました。");
      } else {
        setInfoMessage(null);
      }
      load();
    } catch {
      setDeleteError(NETWORK_ERROR_MESSAGE);
    }
  }

  async function handleRevive(v: VehicleDTO) {
    setReviveError(null);
    try {
      const res = await fetch(`/api/vehicles/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          number: v.number,
          sortOrder: v.sortOrder,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReviveError(data.error ?? "復活に失敗しました");
        return;
      }
      load();
    } catch {
      setReviveError(NETWORK_ERROR_MESSAGE);
    }
  }

  const sorted = [...vehicles].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const activeVehicles = sorted.filter((v) => v.isActive);
  const inactiveVehicles = sorted.filter((v) => !v.isActive);

  if (checkingAuth) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="車両管理" />
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (authCheckError) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="車両管理" />
        <div className="card">
          <p className="text-red-600 font-bold mb-4">{authCheckError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            もう一度読み込む
          </button>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="車両管理" />
        <form onSubmit={handleAuthSubmit} className="card max-w-sm mx-auto flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">管理者パスワード</h2>
            <p className="text-gray-500 text-sm">
              車両管理には管理者パスワードが必要です。
            </p>
          </div>
          {authError && (
            <p className="text-red-600 font-bold bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2">
              {authError}
            </p>
          )}
          <input
            type="password"
            autoFocus
            className="input-field"
            placeholder="パスワード"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
          <button type="submit" disabled={authSubmitting} className="btn-primary">
            {authSubmitting ? "確認中..." : "入る"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-6 pb-16">
      <PageHeader title="車両管理" />

      {infoMessage && (
        <div className="mb-5 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-800 font-bold px-5 py-4">
          {infoMessage}
        </div>
      )}

      {/* 登録・編集フォーム */}
      <form onSubmit={handleSubmit} className="card flex flex-col gap-5 mb-8">
        <h2 className="text-lg font-bold text-gray-700">
          {form.id ? "車両を編集" : "車両を新規登録"}
        </h2>

        {errorMessage && (
          <p className="text-red-600 font-bold bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2">
            {errorMessage}
          </p>
        )}

        <div>
          <label className="label-text">車両名</label>
          <input
            type="text"
            className="input-field"
            placeholder="例：営業車1号"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label-text">車両番号</label>
          <input
            type="text"
            className="input-field"
            placeholder="例：品川300 あ 12-34"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          />
        </div>
        <div className="flex gap-6">
          <div className="flex-1">
            <label className="label-text">表示順</label>
            <input
              type="number"
              className="input-field"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>
          <div className="flex-1">
            <label className="label-text">状態</label>
            <select
              className="input-field bg-white"
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.value === "active" }))
              }
            >
              <option value="active">使用中</option>
              <option value="inactive">使用停止</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex-1">
            {form.id ? "更新する" : "登録する"}
          </button>
          {form.id && (
            <button type="button" onClick={resetForm} className="btn-secondary flex-1">
              新規登録に戻る
            </button>
          )}
        </div>
      </form>

      {/* 一覧 */}
      <h2 className="text-lg font-bold text-gray-700 mb-3">登録済みの車両</h2>
      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : loadError ? (
        <div className="card">
          <p className="text-red-600 font-bold mb-4">{loadError}</p>
          <button onClick={load} className="btn-primary">
            もう一度読み込む
          </button>
        </div>
      ) : activeVehicles.length === 0 ? (
        <p className="text-gray-500">まだ車両が登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeVehicles.map((v) => (
            <div key={v.id} className="card flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-lg text-gray-800">{v.name}</div>
                <div className="text-gray-500 text-sm">{v.number}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => startEdit(v)}
                  className="btn-small border-brand-500 text-brand-600"
                >
                  編集
                </button>
                <button
                  onClick={() => {
                    setDeleteTarget(v);
                    setDeleteError(null);
                  }}
                  className="btn-small border-red-400 text-red-600"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 非表示の車両（復活） */}
      {!loading && !loadError && inactiveVehicles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-bold text-gray-500 mb-3">
            非表示の車両（使用停止中）
          </h2>
          {reviveError && (
            <p className="text-red-600 font-bold mb-3">{reviveError}</p>
          )}
          <div className="flex flex-col gap-2">
            {inactiveVehicles.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div>
                  <div className="font-bold text-gray-600 text-sm">{v.name}</div>
                  <div className="text-gray-400 text-xs">{v.number}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRevive(v)}
                    className="btn-small border-emerald-500 text-emerald-600"
                  >
                    復活させる
                  </button>
                  <button
                    onClick={() => startEdit(v)}
                    className="btn-small border-brand-500 text-brand-600"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => {
                      setDeleteTarget(v);
                      setDeleteError(null);
                    }}
                    className="btn-small border-red-400 text-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="card max-w-sm w-full">
            <p className="text-lg font-bold text-gray-800 mb-2">
              「{deleteTarget.name}」を削除しますか？
            </p>
            <p className="text-gray-500 mb-4">
              利用記録がある場合は削除されず、代わりに非表示（使用停止）になります。
            </p>
            {deleteError && (
              <p className="text-red-600 font-bold mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleDeleteConfirmed} className="btn-danger flex-1">
                削除する
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary flex-1"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
