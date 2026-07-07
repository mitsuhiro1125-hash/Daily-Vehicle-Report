"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import PageHeader from "@/components/PageHeader";
import {
  currentYearMonth,
  toDateDisplayWithWeekday,
  toDateTimeDisplay,
  toDateInputValue,
  formatMeter,
  splitDestinations,
  joinDestinations,
} from "@/lib/utils";
import type { VehicleDTO, VehicleLogDTO } from "@/lib/types";

type EditForm = {
  id: number;
  date: string;
  vehicleId: string;
  destination: string; // 改行区切りのテキストとして編集
  endMeter: string;
  fuelLocation: string;
  fuelAmount: string;
  note: string;
};

export default function GeppoPage() {
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [logs, setLogs] = useState<VehicleLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [vehicleFilter, setVehicleFilter] = useState<string>("");

  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<VehicleLogDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerWarning, setBannerWarning] = useState<string | null>(null);

  useEffect(() => {
    async function loadMasters() {
      const res = await fetch("/api/vehicles?includeInactive=1");
      setVehicles(await res.json());
    }
    loadMasters();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("yearMonth", yearMonth);
    if (vehicleFilter) params.set("vehicleId", vehicleFilter);

    const res = await fetch(`/api/logs?${params.toString()}`);
    const data: VehicleLogDTO[] = await res.json();
    setLogs(data);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, vehicleFilter]);

  // 車両ごとにグループ化し、各グループ内はAPI側で既に日付順に並んでいる
  const groups = useMemo(() => {
    const map = new Map<number, VehicleLogDTO[]>();
    for (const log of logs) {
      const arr = map.get(log.vehicleId) ?? [];
      arr.push(log);
      map.set(log.vehicleId, arr);
    }
    return Array.from(map.entries()).map(([vehicleId, list]) => ({
      vehicleId,
      vehicleName: list[0].vehicle.name,
      vehicleNumber: list[0].vehicle.number,
      list,
    }));
  }, [logs]);

  function meterDiff(list: VehicleLogDTO[], index: number): string {
    if (index === 0) return "―";
    const diff = list[index].endMeter - list[index - 1].endMeter;
    if (diff < 0) return `⚠ ${diff.toLocaleString("ja-JP")} km`;
    return `+${diff.toLocaleString("ja-JP")} km`;
  }

  function handleCsvExport() {
    const params = new URLSearchParams();
    params.set("yearMonth", yearMonth);
    if (vehicleFilter) params.set("vehicleId", vehicleFilter);
    window.location.href = `/api/logs/csv?${params.toString()}`;
  }

  function openEdit(log: VehicleLogDTO) {
    setEditForm({
      id: log.id,
      date: toDateInputValue(log.date),
      vehicleId: String(log.vehicleId),
      destination: log.destination,
      endMeter: String(log.endMeter),
      fuelLocation: log.fuelLocation ?? "",
      fuelAmount: log.fuelAmount !== null ? String(log.fuelAmount) : "",
      note: log.note ?? "",
    });
    setEditErrors({});
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editForm) return;
    setEditErrors({});

    const destinationJoined = joinDestinations(splitDestinations(editForm.destination));
    const newErrors: Record<string, string> = {};
    if (!editForm.date) newErrors.date = "日付は必須です";
    if (!editForm.vehicleId) newErrors.vehicleId = "車両は必須です";
    if (!destinationJoined) newErrors.destination = "訪問先は必須です";
    const meterNum = Number(editForm.endMeter);
    if (editForm.endMeter === "" || Number.isNaN(meterNum) || meterNum < 0) {
      newErrors.endMeter = "0以上の数値を入力してください";
    }
    let fuelAmountNum: number | null = null;
    if (editForm.fuelAmount !== "") {
      fuelAmountNum = Number(editForm.fuelAmount);
      if (Number.isNaN(fuelAmountNum) || fuelAmountNum < 0) {
        newErrors.fuelAmount = "0以上の数値を入力してください";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/logs/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editForm.date,
          vehicleId: Number(editForm.vehicleId),
          destination: destinationJoined,
          endMeter: meterNum,
          fuelLocation: editForm.fuelLocation.trim() || null,
          fuelAmount: fuelAmountNum,
          note: editForm.note,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.errors) {
          const errs: Record<string, string> = {};
          for (const err of data.errors as { field: string; message: string }[]) {
            errs[err.field] = err.message;
          }
          setEditErrors(errs);
        } else {
          setEditErrors({ general: data.error ?? "更新に失敗しました" });
        }
        return;
      }

      const data = await res.json();
      setBannerMessage("更新しました");
      setBannerWarning(data.warning ?? null);
      setEditForm(null);
      loadLogs();
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleteError(null);
    const res = await fetch(`/api/logs/${deleteTarget.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? "削除に失敗しました");
      return;
    }
    setDeleteTarget(null);
    setBannerMessage("削除しました");
    setBannerWarning(null);
    loadLogs();
  }

  return (
    <main className="flex-1 px-6 py-6 pb-16">
      <PageHeader title="月報を見る" />

      {bannerMessage && (
        <div className="mb-5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-800 font-bold text-lg px-5 py-4">
          ✓ {bannerMessage}
          {bannerWarning && (
            <div className="mt-2 text-amber-700 font-normal text-base">
              ⚠ {bannerWarning}
            </div>
          )}
        </div>
      )}

      {/* 絞り込み */}
      <div className="card flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label className="label-text">年月</label>
          <input
            type="month"
            className="input-field"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="label-text">車両</label>
          <select
            className="input-field bg-white"
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
          >
            <option value="">すべて</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end mb-6">
        <button onClick={handleCsvExport} className="btn-primary">
          CSVをダウンロード
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : groups.length === 0 ? (
        <p className="text-gray-500">該当する記録がありません</p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.vehicleId}>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                {group.vehicleName}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {group.vehicleNumber}
                </span>
              </h2>

              {/* PC向け：テーブル表示 */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-3 text-left">日付</th>
                      <th className="px-3 py-3 text-left">訪問先</th>
                      <th className="px-3 py-3 text-right">終業時メーター</th>
                      <th className="px-3 py-3 text-right">前回比</th>
                      <th className="px-3 py-3 text-left">給油場所</th>
                      <th className="px-3 py-3 text-right">給油量</th>
                      <th className="px-3 py-3 text-left">備考</th>
                      <th className="px-3 py-3 text-left">登録日時</th>
                      <th className="px-3 py-3 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.list.map((log, i) => (
                      <tr key={log.id} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-3 whitespace-nowrap">
                          {toDateDisplayWithWeekday(log.date)}
                        </td>
                        <td className="px-3 py-3">
                          {splitDestinations(log.destination).map((d, idx) => (
                            <div key={idx}>・{d}</div>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {formatMeter(log.endMeter)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                          {meterDiff(group.list, i)}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{log.fuelLocation || "―"}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                          {log.fuelAmount !== null ? `${log.fuelAmount} L` : "―"}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{log.note || "―"}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-400">
                          {toDateTimeDisplay(log.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => openEdit(log)}
                              className="btn-small border-brand-500 text-brand-600"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => {
                                setDeleteTarget(log);
                                setDeleteError(null);
                              }}
                              className="btn-small border-red-400 text-red-600"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* スマホ向け：カード表示 */}
              <div className="md:hidden flex flex-col gap-3">
                {group.list.map((log, i) => (
                  <div key={log.id} className="card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-800">
                        {toDateDisplayWithWeekday(log.date)}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {splitDestinations(log.destination).map((d, idx) => (
                        <div key={idx}>・{d}</div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-gray-800">
                        {formatMeter(log.endMeter)}
                      </span>
                      <span className="text-gray-500">{meterDiff(group.list, i)}</span>
                    </div>
                    {(log.fuelLocation || log.fuelAmount !== null) && (
                      <div className="text-sm text-gray-500 mb-2">
                        給油：{log.fuelLocation || "―"}
                        {log.fuelAmount !== null ? `（${log.fuelAmount} L）` : ""}
                      </div>
                    )}
                    {log.note && (
                      <div className="text-sm text-gray-500 mb-2">備考：{log.note}</div>
                    )}
                    <div className="text-xs text-gray-400 mb-3">
                      登録：{toDateTimeDisplay(log.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(log)}
                        className="btn-small border-brand-500 text-brand-600 flex-1"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => {
                          setDeleteTarget(log);
                          setDeleteError(null);
                        }}
                        className="btn-small border-red-400 text-red-600 flex-1"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 編集モーダル */}
      {editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 py-8 z-50 overflow-y-auto">
          <form
            onSubmit={handleEditSubmit}
            className="card max-w-lg w-full flex flex-col gap-4 my-auto"
          >
            <h2 className="text-lg font-bold text-gray-800">記録を編集</h2>

            {editErrors.general && (
              <p className="text-red-600 font-bold">{editErrors.general}</p>
            )}

            <div>
              <label className="label-text">日付</label>
              <input
                type="date"
                className="input-field"
                value={editForm.date}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, date: e.target.value } : f))
                }
              />
              {editErrors.date && <p className="text-red-600 font-bold">{editErrors.date}</p>}
            </div>

            <div>
              <label className="label-text">車両</label>
              <select
                className="input-field bg-white"
                value={editForm.vehicleId}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, vehicleId: e.target.value } : f))
                }
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              {editErrors.vehicleId && (
                <p className="text-red-600 font-bold">{editErrors.vehicleId}</p>
              )}
            </div>

            <div>
              <label className="label-text">訪問先（複数ある場合は改行で分けてください）</label>
              <textarea
                className="input-field min-h-[90px]"
                value={editForm.destination}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, destination: e.target.value } : f))
                }
              />
              {editErrors.destination && (
                <p className="text-red-600 font-bold">{editErrors.destination}</p>
              )}
            </div>

            <div>
              <label className="label-text">終業時メーター（km）</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="input-field"
                value={editForm.endMeter}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, endMeter: e.target.value } : f))
                }
              />
              {editErrors.endMeter && (
                <p className="text-red-600 font-bold">{editErrors.endMeter}</p>
              )}
            </div>

            <div>
              <label className="label-text">給油場所（任意）</label>
              <input
                type="text"
                className="input-field"
                value={editForm.fuelLocation}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, fuelLocation: e.target.value } : f))
                }
              />
            </div>

            <div>
              <label className="label-text">給油量（L・任意）</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                className="input-field"
                value={editForm.fuelAmount}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, fuelAmount: e.target.value } : f))
                }
              />
              {editErrors.fuelAmount && (
                <p className="text-red-600 font-bold">{editErrors.fuelAmount}</p>
              )}
            </div>

            <div>
              <label className="label-text">備考（任意）</label>
              <p className="text-sm text-gray-500 mb-2">
                使用高速道路（＊参照）、消耗品料、作業料、その他費用
                <br />
                ＊使用高速道路：①NEXCO、②阪神高速、③神戸公社、④その他
              </p>
              <textarea
                className="input-field min-h-[70px]"
                value={editForm.note}
                onChange={(e) =>
                  setEditForm((f) => (f ? { ...f, note: e.target.value } : f))
                }
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={editSubmitting} className="btn-primary flex-1">
                {editSubmitting ? "更新中..." : "更新する"}
              </button>
              <button
                type="button"
                onClick={() => setEditForm(null)}
                className="btn-secondary flex-1"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="card max-w-sm w-full">
            <p className="text-lg font-bold text-gray-800 mb-2">
              {toDateDisplayWithWeekday(deleteTarget.date)}の記録を削除しますか？
            </p>
            <p className="text-gray-500 mb-4">この操作は取り消せません。</p>
            {deleteError && <p className="text-red-600 font-bold mb-4">{deleteError}</p>}
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
