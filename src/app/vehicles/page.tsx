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

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/vehicles?includeInactive=1");
    const data: VehicleDTO[] = await res.json();
    setVehicles(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(v: VehicleDTO) {
    setForm({
      id: v.id,
      name: v.name,
      number: v.number,
      sortOrder: String(v.sortOrder),
      isActive: v.isActive,
    });
    setErrorMessage(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setErrorMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

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
      const data = await res.json();
      setErrorMessage(data.error ?? "保存に失敗しました");
      return;
    }

    resetForm();
    load();
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const res = await fetch(`/api/vehicles/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? "削除に失敗しました");
      return;
    }
    setDeleteTarget(null);
    load();
  }

  const sorted = [...vehicles].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  return (
    <main className="flex-1 px-6 py-6 pb-16">
      <PageHeader title="車両管理" />

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
      ) : sorted.length === 0 ? (
        <p className="text-gray-500">まだ車両が登録されていません</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((v) => (
            <div key={v.id} className="card flex items-center justify-between gap-4">
              <div>
                <div className="font-bold text-lg text-gray-800">
                  {v.name}
                  {!v.isActive && (
                    <span className="ml-2 text-sm font-bold text-gray-400">
                      （使用停止）
                    </span>
                  )}
                </div>
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

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="card max-w-sm w-full">
            <p className="text-lg font-bold text-gray-800 mb-2">
              「{deleteTarget.name}」を削除しますか？
            </p>
            <p className="text-gray-500 mb-4">この操作は取り消せません。</p>
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
