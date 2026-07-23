"use client";

import { useEffect, useState, type FormEvent } from "react";
import PageHeader from "@/components/PageHeader";
import type { VehicleDTO, DepartmentDTO } from "@/lib/types";

type VehicleFormState = {
  id: number | null;
  name: string;
  number: string;
  departmentId: string; // "" = 未分類
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_VEHICLE_FORM: VehicleFormState = {
  id: null,
  name: "",
  number: "",
  departmentId: "",
  sortOrder: "0",
  isActive: true,
};

type DepartmentFormState = {
  id: number | null;
  name: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = {
  id: null,
  name: "",
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
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<VehicleFormState>(EMPTY_VEHICLE_FORM);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reviveError, setReviveError] = useState<string | null>(null);

  // 所属管理用
  const [showDepartments, setShowDepartments] = useState(false);
  const [deptForm, setDeptForm] = useState<DepartmentFormState>(EMPTY_DEPARTMENT_FORM);
  const [deptErrorMessage, setDeptErrorMessage] = useState<string | null>(null);
  const [deptDeleteTarget, setDeptDeleteTarget] = useState<DepartmentDTO | null>(null);
  const [deptDeleteError, setDeptDeleteError] = useState<string | null>(null);
  const [deptReviveError, setDeptReviveError] = useState<string | null>(null);

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
      const [vRes, dRes] = await Promise.all([
        fetch("/api/vehicles?includeInactive=1"),
        fetch("/api/departments?includeInactive=1"),
      ]);
      if (!vRes.ok || !dRes.ok) throw new Error("failed");
      const [vData, dData]: [VehicleDTO[], DepartmentDTO[]] = await Promise.all([
        vRes.json(),
        dRes.json(),
      ]);
      setVehicles(vData);
      setDepartments(dData);
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

  // ---------- 車両 ----------

  function startEdit(v: VehicleDTO) {
    setForm({
      id: v.id,
      name: v.name,
      number: v.number,
      departmentId: v.departmentId !== null ? String(v.departmentId) : "",
      sortOrder: String(v.sortOrder),
      isActive: v.isActive,
    });
    setErrorMessage(null);
    setInfoMessage(null);
  }

  function resetForm() {
    setForm(EMPTY_VEHICLE_FORM);
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
      departmentId: form.departmentId === "" ? null : Number(form.departmentId),
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
          departmentId: v.departmentId,
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

  // ---------- 所属 ----------

  function startEditDept(d: DepartmentDTO) {
    setDeptForm({
      id: d.id,
      name: d.name,
      sortOrder: String(d.sortOrder),
      isActive: d.isActive,
    });
    setDeptErrorMessage(null);
  }

  function resetDeptForm() {
    setDeptForm(EMPTY_DEPARTMENT_FORM);
    setDeptErrorMessage(null);
  }

  async function handleDeptSubmit(e: FormEvent) {
    e.preventDefault();
    setDeptErrorMessage(null);

    if (!deptForm.name.trim()) {
      setDeptErrorMessage("所属名は必須です");
      return;
    }

    const payload = {
      name: deptForm.name.trim(),
      sortOrder: Number(deptForm.sortOrder) || 0,
      isActive: deptForm.isActive,
    };

    try {
      const res = deptForm.id
        ? await fetch(`/api/departments/${deptForm.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeptErrorMessage(data.error ?? "保存に失敗しました");
        return;
      }

      resetDeptForm();
      load();
    } catch {
      setDeptErrorMessage(NETWORK_ERROR_MESSAGE);
    }
  }

  async function handleDeptDeleteConfirmed() {
    if (!deptDeleteTarget) return;
    setDeptDeleteError(null);
    try {
      const res = await fetch(`/api/departments/${deptDeleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeptDeleteError(data.error ?? "削除に失敗しました");
        return;
      }

      setDeptDeleteTarget(null);
      load();
    } catch {
      setDeptDeleteError(NETWORK_ERROR_MESSAGE);
    }
  }

  async function handleDeptRevive(d: DepartmentDTO) {
    setDeptReviveError(null);
    try {
      const res = await fetch(`/api/departments/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          sortOrder: d.sortOrder,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeptReviveError(data.error ?? "復活に失敗しました");
        return;
      }
      load();
    } catch {
      setDeptReviveError(NETWORK_ERROR_MESSAGE);
    }
  }

  const sortedVehicles = [...vehicles].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
  );
  const activeVehicles = sortedVehicles.filter((v) => v.isActive);
  const inactiveVehicles = sortedVehicles.filter((v) => !v.isActive);

  // 有効な車両を所属ごとにグループ化（未分類は最後）
  const vehiclesByDepartment = (() => {
    const groups = new Map<string, { label: string; sortOrder: number; vehicles: VehicleDTO[] }>();
    for (const v of activeVehicles) {
      const key = v.departmentId !== null ? `dept-${v.departmentId}` : "none";
      const label = v.department ? v.department.name : "未分類";
      const sortOrder = v.department ? v.department.sortOrder : Number.MAX_SAFE_INTEGER;
      const g = groups.get(key) ?? { label, sortOrder, vehicles: [] as VehicleDTO[] };
      g.vehicles.push(v);
      groups.set(key, g);
    }
    return Array.from(groups.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  })();

  const sortedDepartments = [...departments].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
  );
  const activeDepartments = sortedDepartments.filter((d) => d.isActive);
  const inactiveDepartments = sortedDepartments.filter((d) => !d.isActive);

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

      {/* 所属管理（折りたたみ） */}
      <div className="mb-8">
        <button
          type="button"
          onClick={() => setShowDepartments((s) => !s)}
          className="w-full flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-left"
        >
          <h2 className="text-base font-bold text-gray-700">所属の管理</h2>
          <span
            className={`shrink-0 text-gray-400 transition-transform ${showDepartments ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </button>

        {showDepartments && (
          <div className="mt-3 flex flex-col gap-4">
            <form onSubmit={handleDeptSubmit} className="card flex flex-col gap-4">
              <h3 className="text-base font-bold text-gray-700">
                {deptForm.id ? "所属を編集" : "所属を新規登録"}
              </h3>
              {deptErrorMessage && (
                <p className="text-red-600 font-bold bg-red-50 border-2 border-red-300 rounded-lg px-4 py-2">
                  {deptErrorMessage}
                </p>
              )}
              <div>
                <label className="label-text">所属名</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="例：本社、西営業所"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="label-text">表示順</label>
                  <input
                    type="number"
                    className="input-field"
                    value={deptForm.sortOrder}
                    onChange={(e) =>
                      setDeptForm((f) => ({ ...f, sortOrder: e.target.value }))
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="label-text">状態</label>
                  <select
                    className="input-field bg-white"
                    value={deptForm.isActive ? "active" : "inactive"}
                    onChange={(e) =>
                      setDeptForm((f) => ({ ...f, isActive: e.target.value === "active" }))
                    }
                  >
                    <option value="active">使用中</option>
                    <option value="inactive">使用停止</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">
                  {deptForm.id ? "更新する" : "登録する"}
                </button>
                {deptForm.id && (
                  <button
                    type="button"
                    onClick={resetDeptForm}
                    className="btn-secondary flex-1"
                  >
                    新規登録に戻る
                  </button>
                )}
              </div>
            </form>

            {activeDepartments.length > 0 && (
              <div className="flex flex-col gap-2">
                {activeDepartments.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="font-bold text-gray-800">{d.name}</div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEditDept(d)}
                        className="btn-small border-brand-500 text-brand-600"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => {
                          setDeptDeleteTarget(d);
                          setDeptDeleteError(null);
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

            {inactiveDepartments.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-2">
                  非表示の所属（使用停止中）
                </h4>
                {deptReviveError && (
                  <p className="text-red-600 font-bold mb-2 text-sm">{deptReviveError}</p>
                )}
                <div className="flex flex-col gap-2">
                  {inactiveDepartments.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2"
                    >
                      <div className="text-gray-600 text-sm font-bold">{d.name}</div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleDeptRevive(d)}
                          className="btn-small border-emerald-500 text-emerald-600"
                        >
                          復活させる
                        </button>
                        <button
                          onClick={() => startEditDept(d)}
                          className="btn-small border-brand-500 text-brand-600"
                        >
                          編集
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 車両 登録・編集フォーム */}
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
        <div>
          <label className="label-text">所属</label>
          <select
            className="input-field bg-white"
            value={form.departmentId}
            onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
          >
            <option value="">未分類</option>
            {activeDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
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

      {/* 一覧（所属ごとにグループ表示） */}
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
        <div className="flex flex-col gap-6">
          {vehiclesByDepartment.map((g) => (
            <div key={g.label}>
              <h3 className="text-sm font-bold text-gray-500 mb-2">{g.label}</h3>
              <div className="flex flex-col gap-3">
                {g.vehicles.map((v) => (
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

      {/* 車両 削除確認ダイアログ */}
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

      {/* 所属 削除確認ダイアログ */}
      {deptDeleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="card max-w-sm w-full">
            <p className="text-lg font-bold text-gray-800 mb-2">
              「{deptDeleteTarget.name}」を削除しますか？
            </p>
            <p className="text-gray-500 mb-4">
              紐づく車両がある場合は削除されず、代わりに非表示（使用停止）になります。
            </p>
            {deptDeleteError && (
              <p className="text-red-600 font-bold mb-4">{deptDeleteError}</p>
            )}
            <div className="flex gap-3">
              <button onClick={handleDeptDeleteConfirmed} className="btn-danger flex-1">
                削除する
              </button>
              <button
                onClick={() => setDeptDeleteTarget(null)}
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
