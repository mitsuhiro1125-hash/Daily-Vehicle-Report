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

type DayGroup = {
  date: string;
  logs: VehicleLogDTO[];
  // 同日に複数件ある場合にまとめた表示用の値
  mergedDestinations: string[];
  mergedEndMeter: number;
  mergedFuelLocation: string | null;
  mergedFuelAmount: number | null;
  mergedNote: string | null;
  latestCreatedAt: string;
};

function mergeDayLogs(date: string, logs: VehicleLogDTO[]): DayGroup {
  const mergedDestinations = logs.flatMap((log) => splitDestinations(log.destination));
  const mergedEndMeter = Math.max(...logs.map((log) => log.endMeter));
  const fuelLocations = logs.map((log) => log.fuelLocation).filter((v): v is string => !!v);
  const mergedFuelLocation = fuelLocations.length > 0 ? fuelLocations.join("、") : null;
  const fuelAmounts = logs
    .map((log) => log.fuelAmount)
    .filter((v): v is number => v !== null && v !== undefined);
  const mergedFuelAmount = fuelAmounts.length > 0 ? fuelAmounts.reduce((a, b) => a + b, 0) : null;
  const notes = logs.map((log) => log.note).filter((v): v is string => !!v);
  const mergedNote = notes.length > 0 ? notes.join(" ／ ") : null;
  const latestCreatedAt = logs
    .map((log) => log.createdAt)
    .sort((a, b) => (a > b ? -1 : 1))[0];

  return {
    date,
    logs,
    mergedDestinations,
    mergedEndMeter,
    mergedFuelLocation,
    mergedFuelAmount,
    mergedNote,
    latestCreatedAt,
  };
}

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

  const [breakdownGroup, setBreakdownGroup] = useState<{
    vehicleName: string;
    dayGroup: DayGroup;
  } | null>(null);

  // 車両ごとの表示（アコーディオン）の開閉状態
  const [expandedVehicles, setExpandedVehicles] = useState<Set<number>>(new Set());

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

  // 車両を1台に絞り込んだときはその車両を自動的に開き、
  // 「すべて」に戻したときはいったん全部たたんだ状態に戻す
  useEffect(() => {
    if (vehicleFilter) {
      setExpandedVehicles(new Set([Number(vehicleFilter)]));
    } else {
      setExpandedVehicles(new Set());
    }
  }, [vehicleFilter, yearMonth]);

  function toggleVehicleExpanded(vehicleId: number) {
    setExpandedVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  }

  // 車両ごとにグループ化し、さらに同じ日付の記録を1つにまとめる
  // （同日に2回以上入力された場合、月報では1行にまとめて表示するため）
  const groups = useMemo(() => {
    const map = new Map<number, VehicleLogDTO[]>();
    for (const log of logs) {
      const arr = map.get(log.vehicleId) ?? [];
      arr.push(log);
      map.set(log.vehicleId, arr);
    }
    return Array.from(map.entries()).map(([vehicleId, list]) => {
      const byDate = new Map<string, VehicleLogDTO[]>();
      for (const log of list) {
        const key = toDateInputValue(log.date);
        const arr = byDate.get(key) ?? [];
        arr.push(log);
        byDate.set(key, arr);
      }
      const dayGroups = Array.from(byDate.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, dayLogs]) => mergeDayLogs(date, dayLogs));

      return {
        vehicleId,
        vehicleName: list[0].vehicle.name,
        vehicleNumber: list[0].vehicle.number,
        dayGroups,
      };
    });
  }, [logs]);

  function meterDiff(dayGroups: DayGroup[], index: number): string {
    if (index === 0) return "―";
    const diff = dayGroups[index].mergedEndMeter - dayGroups[index - 1].mergedEndMeter;
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

  function openRowAction(vehicleName: string, dayGroup: DayGroup) {
    if (dayGroup.logs.length === 1) {
      openEdit(dayGroup.logs[0]);
    } else {
      setBreakdownGroup({ vehicleName, dayGroup });
    }
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
      setBreakdownGroup(null);
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
    setBreakdownGroup(null);
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
          {groups.map((group) => {
            const isExpanded = expandedVehicles.has(group.vehicleId);
            const enteredDays = group.dayGroups.filter((d) => d.logs.length > 0).length;
            return (
            <section key={group.vehicleId}>
              <button
                type="button"
                onClick={() => toggleVehicleExpanded(group.vehicleId)}
                className="w-full flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 text-left"
              >
                <h2 className="text-lg font-bold text-gray-800">
                  {group.vehicleName}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    {group.vehicleNumber}
                  </span>
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    （入力あり：{enteredDays}日）
                  </span>
                </h2>
                <span
                  className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>

              {isExpanded && (
                <>
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
                    {group.dayGroups.map((dayGroup, i) => (
                      <tr key={dayGroup.date} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-3 whitespace-nowrap">
                          {toDateDisplayWithWeekday(dayGroup.date)}
                          {dayGroup.logs.length > 1 && (
                            <span className="ml-2 inline-block text-xs font-bold text-brand-600 bg-brand-50 rounded px-2 py-0.5">
                              {dayGroup.logs.length}件
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {dayGroup.mergedDestinations.map((d, idx) => (
                            <div key={idx}>・{d}</div>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {formatMeter(dayGroup.mergedEndMeter)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                          {meterDiff(group.dayGroups, i)}
                        </td>
                        <td className="px-3 py-3 text-gray-500">
                          {dayGroup.mergedFuelLocation || "―"}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-gray-500">
                          {dayGroup.mergedFuelAmount !== null ? `${dayGroup.mergedFuelAmount} L` : "―"}
                        </td>
                        <td className="px-3 py-3 text-gray-500">{dayGroup.mergedNote || "―"}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-400">
                          {toDateTimeDisplay(dayGroup.latestCreatedAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2 justify-center">
                            {dayGroup.logs.length > 1 ? (
                              <button
                                onClick={() => openRowAction(group.vehicleName, dayGroup)}
                                className="btn-small border-brand-500 text-brand-600"
                              >
                                内訳を見る
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEdit(dayGroup.logs[0])}
                                  className="btn-small border-brand-500 text-brand-600"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteTarget(dayGroup.logs[0]);
                                    setDeleteError(null);
                                  }}
                                  className="btn-small border-red-400 text-red-600"
                                >
                                  削除
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* スマホ向け：カード表示 */}
              <div className="md:hidden flex flex-col gap-3">
                {group.dayGroups.map((dayGroup, i) => (
                  <div key={dayGroup.date} className="card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-800">
                        {toDateDisplayWithWeekday(dayGroup.date)}
                        {dayGroup.logs.length > 1 && (
                          <span className="ml-2 inline-block text-xs font-bold text-brand-600 bg-brand-50 rounded px-2 py-0.5">
                            {dayGroup.logs.length}件
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {dayGroup.mergedDestinations.map((d, idx) => (
                        <div key={idx}>・{d}</div>
                      ))}
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-bold text-gray-800">
                        {formatMeter(dayGroup.mergedEndMeter)}
                      </span>
                      <span className="text-gray-500">{meterDiff(group.dayGroups, i)}</span>
                    </div>
                    {(dayGroup.mergedFuelLocation || dayGroup.mergedFuelAmount !== null) && (
                      <div className="text-sm text-gray-500 mb-2">
                        給油：{dayGroup.mergedFuelLocation || "―"}
                        {dayGroup.mergedFuelAmount !== null ? `（${dayGroup.mergedFuelAmount} L）` : ""}
                      </div>
                    )}
                    {dayGroup.mergedNote && (
                      <div className="text-sm text-gray-500 mb-2">備考：{dayGroup.mergedNote}</div>
                    )}
                    <div className="text-xs text-gray-400 mb-3">
                      登録：{toDateTimeDisplay(dayGroup.latestCreatedAt)}
                    </div>
                    <div className="flex gap-2">
                      {dayGroup.logs.length > 1 ? (
                        <button
                          onClick={() => openRowAction(group.vehicleName, dayGroup)}
                          className="btn-small border-brand-500 text-brand-600 flex-1"
                        >
                          内訳を見る
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(dayGroup.logs[0])}
                            className="btn-small border-brand-500 text-brand-600 flex-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(dayGroup.logs[0]);
                              setDeleteError(null);
                            }}
                            className="btn-small border-red-400 text-red-600 flex-1"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
                </>
              )}
            </section>
            );
          })}
        </div>
      )}

      {/* 内訳モーダル（同日に複数件ある場合） */}
      {breakdownGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 py-8 z-50 overflow-y-auto">
          <div className="card max-w-lg w-full flex flex-col gap-4 my-auto">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {toDateDisplayWithWeekday(breakdownGroup.dayGroup.date)}の内訳
              </h2>
              <p className="text-sm text-gray-500">
                {breakdownGroup.vehicleName}／{breakdownGroup.dayGroup.logs.length}件の入力があります
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {breakdownGroup.dayGroup.logs.map((log, idx) => (
                <div key={log.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="text-sm font-bold text-gray-500 mb-2">{idx + 1}回目</div>
                  <div className="text-sm text-gray-700 mb-1">
                    {splitDestinations(log.destination).map((d, dIdx) => (
                      <div key={dIdx}>・{d}</div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    終業時メーター：{formatMeter(log.endMeter)}
                  </div>
                  {(log.fuelLocation || log.fuelAmount !== null) && (
                    <div className="text-sm text-gray-500 mb-1">
                      給油：{log.fuelLocation || "―"}
                      {log.fuelAmount !== null ? `（${log.fuelAmount} L）` : ""}
                    </div>
                  )}
                  {log.note && (
                    <div className="text-sm text-gray-500 mb-1">備考：{log.note}</div>
                  )}
                  <div className="text-xs text-gray-400 mb-3">
                    登録：{toDateTimeDisplay(log.createdAt)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setBreakdownGroup(null);
                        openEdit(log);
                      }}
                      className="btn-small border-brand-500 text-brand-600 flex-1"
                    >
                      この記録を編集
                    </button>
                    <button
                      onClick={() => {
                        setDeleteTarget(log);
                        setDeleteError(null);
                      }}
                      className="btn-small border-red-400 text-red-600 flex-1"
                    >
                      この記録を削除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setBreakdownGroup(null)}
              className="btn-secondary"
            >
              閉じる
            </button>
          </div>
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
                step="0.01"
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
