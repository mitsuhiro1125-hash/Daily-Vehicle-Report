"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { todayInputValue, joinDestinations } from "@/lib/utils";
import type { VehicleDTO, DepartmentDTO } from "@/lib/types";

type FormErrors = Partial<
  Record<"date" | "vehicleId" | "destination" | "endMeter" | "fuelAmount", string>
>;

const LAST_VEHICLE_STORAGE_KEY = "vehicle-report:lastVehicleId";
const LAST_DEPARTMENT_STORAGE_KEY = "vehicle-report:lastDepartmentId";
const MY_DESTINATIONS_KEY = "vehicle-report:myDestinations";
const MY_FUEL_LOCATIONS_KEY = "vehicle-report:myFuelLocations";
const MAX_FAVORITES = 12;

function loadFavoriteList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveFavoriteList(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 保存に失敗しても入力自体は継続できるよう、エラーは無視する
  }
}

function addFavorite(key: string, value: string, current: string[]): string[] {
  const trimmed = value.trim();
  if (!trimmed) return current;
  const withoutDup = current.filter((v) => v !== trimmed);
  const next = [trimmed, ...withoutDup].slice(0, MAX_FAVORITES);
  saveFavoriteList(key, next);
  return next;
}

function removeFavorite(key: string, value: string, current: string[]): string[] {
  const next = current.filter((v) => v !== value);
  saveFavoriteList(key, next);
  return next;
}

export default function NippoPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [date, setDate] = useState(todayInputValue());
  const [vehicleId, setVehicleId] = useState<string>("");
  const [destinations, setDestinations] = useState<string[]>([""]);
  const [endMeter, setEndMeter] = useState<string>("");
  const [fuelLocation, setFuelLocation] = useState("");
  const [fuelAmount, setFuelAmount] = useState("");
  const [note, setNote] = useState("");

  const [myDestinations, setMyDestinations] = useState<string[]>([]);
  const [myFuelLocations, setMyFuelLocations] = useState<string[]>([]);

  const [lastMeter, setLastMeter] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingMasters(true);
      setLoadError(null);
      try {
        const [vRes, dRes] = await Promise.all([fetch("/api/vehicles"), fetch("/api/departments")]);
        if (!vRes.ok || !dRes.ok) throw new Error("failed to load masters");
        const [vData, dData]: [VehicleDTO[], DepartmentDTO[]] = await Promise.all([
          vRes.json(),
          dRes.json(),
        ]);
        setVehicles(vData);
        setDepartments(dData);

        const rememberedDept = window.localStorage.getItem(LAST_DEPARTMENT_STORAGE_KEY);
        let restoredDept = "";
        if (
          rememberedDept &&
          (rememberedDept === "none" || dData.some((d) => String(d.id) === rememberedDept))
        ) {
          restoredDept = rememberedDept;
          setDepartmentId(rememberedDept);
        }

        const rememberedVehicle = window.localStorage.getItem(LAST_VEHICLE_STORAGE_KEY);
        if (rememberedVehicle) {
          const v = vData.find((vv) => String(vv.id) === rememberedVehicle);
          if (v) {
            const matchesDept =
              restoredDept === "" ||
              (restoredDept === "none"
                ? v.departmentId === null
                : v.departmentId === Number(restoredDept));
            if (matchesDept) {
              setVehicleId(rememberedVehicle);
            }
          }
        }

        setMyDestinations(loadFavoriteList(MY_DESTINATIONS_KEY));
        setMyFuelLocations(loadFavoriteList(MY_FUEL_LOCATIONS_KEY));
      } catch {
        setLoadError(
          "車両・部署の一覧を読み込めませんでした。電波・Wi-Fiの状態を確認して、もう一度お試しください。"
        );
      } finally {
        setLoadingMasters(false);
      }
    }
    load();
  }, []);

  const fetchLastMeter = useCallback(async (vId: string) => {
    if (!vId) {
      setLastMeter(null);
      return;
    }
    try {
      const res = await fetch(`/api/logs/last-meter?vehicleId=${vId}`);
      if (res.ok) {
        const data = await res.json();
        setLastMeter(typeof data.lastMeter === "number" ? data.lastMeter : null);
      }
    } catch {
      setLastMeter(null);
    }
  }, []);

  useEffect(() => {
    fetchLastMeter(vehicleId);
  }, [vehicleId, fetchLastMeter]);

  function handleVehicleChange(newVehicleId: string) {
    setVehicleId(newVehicleId);
    if (newVehicleId) {
      window.localStorage.setItem(LAST_VEHICLE_STORAGE_KEY, newVehicleId);
    }
  }

  function handleDepartmentChange(newDepartmentId: string) {
    setDepartmentId(newDepartmentId);
    window.localStorage.setItem(LAST_DEPARTMENT_STORAGE_KEY, newDepartmentId);

    if (vehicleId) {
      const currentVehicle = vehicles.find((v) => String(v.id) === vehicleId);
      const stillValid =
        currentVehicle &&
        (newDepartmentId === "" ||
          (newDepartmentId === "none"
            ? currentVehicle.departmentId === null
            : currentVehicle.departmentId === Number(newDepartmentId)));
      if (!stillValid) {
        setVehicleId("");
      }
    }
  }

  function addDestinationField() {
    setDestinations((prev) => [...prev, ""]);
  }

  function removeDestinationField(index: number) {
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDestinationField(index: number, value: string) {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function handleSelectFavoriteDestination(value: string) {
    setDestinations((prev) => {
      const emptyIndex = prev.findIndex((d) => d.trim() === "");
      if (emptyIndex !== -1) {
        const next = [...prev];
        next[emptyIndex] = value;
        return next;
      }
      return [...prev, value];
    });
  }

  function clearForm() {
    setDate(todayInputValue());
    setVehicleId("");
    setDestinations([""]);
    setEndMeter("");
    setFuelLocation("");
    setFuelAmount("");
    setNote("");
    setErrors({});
    setSubmitError(null);
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!date) newErrors.date = "日付を入力してください";
    if (!vehicleId) newErrors.vehicleId = "車両を選択してください";

    const joined = joinDestinations(destinations);
    if (!joined) newErrors.destination = "訪問先を入力してください";

    if (endMeter === "") {
      newErrors.endMeter = "終業時メーターを入力してください";
    } else {
      const n = Number(endMeter);
      if (Number.isNaN(n) || n < 0) newErrors.endMeter = "0以上の数値を入力してください";
    }

    if (fuelAmount !== "") {
      const n = Number(fuelAmount);
      if (Number.isNaN(n) || n < 0) newErrors.fuelAmount = "0以上の数値を入力してください";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          vehicleId: Number(vehicleId),
          destination: joinDestinations(destinations),
          endMeter: Number(endMeter),
          fuelLocation: fuelLocation.trim() || null,
          fuelAmount: fuelAmount === "" ? null : Number(fuelAmount),
          note,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.errors) {
          const newErrors: FormErrors = {};
          for (const err of data.errors as { field: string; message: string }[]) {
            newErrors[err.field as keyof FormErrors] = err.message;
          }
          setErrors(newErrors);
        } else {
          setSubmitError(data.error ?? "登録に失敗しました");
        }
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      const params = new URLSearchParams({ registered: "1" });
      if (data.warning) params.set("warning", data.warning);
      router.push(`/?${params.toString()}`);
    } catch {
      setSubmitError(
        "通信エラーが発生しました。電波・Wi-Fiの状態を確認して、もう一度お試しください。"
      );
      setSubmitting(false);
    }
  }

  const enteredMeterNum = endMeter === "" ? null : Number(endMeter);
  const showMeterCaution =
    lastMeter !== null &&
    enteredMeterNum !== null &&
    !Number.isNaN(enteredMeterNum) &&
    enteredMeterNum < lastMeter;

  const filteredVehicles = vehicles.filter((v) => {
    if (departmentId === "") return true;
    if (departmentId === "none") return v.departmentId === null;
    return v.departmentId === Number(departmentId);
  });

  const groupedVehicles = (() => {
    const groups = new Map<string, { label: string; vehicles: VehicleDTO[] }>();
    for (const v of filteredVehicles) {
      const key = v.department ? `dept-${v.department.id}` : "none";
      const label = v.department ? v.department.name : "未分類";
      const g = groups.get(key) ?? { label, vehicles: [] as VehicleDTO[] };
      g.vehicles.push(v);
      groups.set(key, g);
    }
    return Array.from(groups.values());
  })();

  if (loadingMasters) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="日報を入力する" />
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="日報を入力する" />
        <div className="card">
          <p className="text-red-600 font-bold mb-4">{loadError}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            もう一度読み込む
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-6 pb-16">
      <PageHeader title="日報を入力する" />

      {submitError && (
        <div className="mb-5 rounded-xl bg-red-50 border-2 border-red-400 text-red-700 font-bold px-5 py-4">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card flex flex-col gap-6">
        <div>
          <label className="label-text">日付</label>
          <input
            type="date"
            className="input-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {errors.date && <p className="text-red-600 font-bold mt-1">{errors.date}</p>}
        </div>

        <div>
          <label className="label-text">部署</label>
          <select
            className="input-field bg-white"
            value={departmentId}
            onChange={(e) => handleDepartmentChange(e.target.value)}
          >
            <option value="">すべて</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="none">未分類</option>
          </select>
          <p className="text-sm text-gray-500 mt-1">
            部署を選ぶと、下の車両の選択肢がその部署のものだけに絞り込まれます。
          </p>
        </div>

        <div>
          <label className="label-text">車両</label>
          <select
            className="input-field bg-white"
            value={vehicleId}
            onChange={(e) => handleVehicleChange(e.target.value)}
          >
            <option value="">選択してください</option>
            {departmentId === ""
              ? groupedVehicles.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                ))
              : filteredVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
          </select>
          {errors.vehicleId && <p className="text-red-600 font-bold mt-1">{errors.vehicleId}</p>}
        </div>

        <div>
          <label className="label-text">訪問先</label>
          <div className="flex flex-col gap-3">
            {destinations.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  className="input-field"
                  placeholder={`訪問先${i + 1}`}
                  value={d}
                  onChange={(e) => updateDestinationField(i, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMyDestinations(addFavorite(MY_DESTINATIONS_KEY, d, myDestinations))}
                  disabled={!d.trim() || myDestinations.includes(d.trim())}
                  className="btn-small border-amber-400 text-amber-600 shrink-0 disabled:opacity-30"
                  aria-label="この訪問先をマイリストに保存"
                >
                  ☆保存
                </button>
                {destinations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDestinationField(i)}
                    className="btn-small border-gray-300 text-gray-500 shrink-0"
                    aria-label="この訪問先を削除"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addDestinationField}
            className="mt-3 btn-small border-brand-500 text-brand-600"
          >
            ＋ 訪問先を追加
          </button>
          {errors.destination && (
            <p className="text-red-600 font-bold mt-1">{errors.destination}</p>
          )}

          {myDestinations.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-gray-500 mb-2">よく行く訪問先</p>
              <div className="flex flex-wrap gap-2">
                {myDestinations.map((fav) => (
                  <div
                    key={fav}
                    className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full pl-3 pr-1 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectFavoriteDestination(fav)}
                      className="text-sm text-amber-800 font-bold"
                    >
                      {fav}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMyDestinations(removeFavorite(MY_DESTINATIONS_KEY, fav, myDestinations))
                      }
                      className="text-gray-400 text-xs px-2 py-1"
                      aria-label="マイリストから削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label-text">終業時メーター（km）</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className="input-field"
            placeholder="例：12345"
            value={endMeter}
            onChange={(e) => setEndMeter(e.target.value)}
          />
          {lastMeter !== null && (
            <p className="text-sm text-gray-500 mt-1">
              前回登録時のメーター：{lastMeter.toLocaleString("ja-JP")} km
            </p>
          )}
          {showMeterCaution && (
            <p className="text-amber-600 font-bold mt-1">
              ⚠ 前回より小さい値です。ご確認のうえ登録してください。
            </p>
          )}
          {errors.endMeter && <p className="text-red-600 font-bold mt-1">{errors.endMeter}</p>}
        </div>

        <div>
          <label className="label-text">給油場所（任意）</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input-field"
              placeholder="例：ENEOS 目黒店"
              value={fuelLocation}
              onChange={(e) => setFuelLocation(e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                setMyFuelLocations(addFavorite(MY_FUEL_LOCATIONS_KEY, fuelLocation, myFuelLocations))
              }
              disabled={!fuelLocation.trim() || myFuelLocations.includes(fuelLocation.trim())}
              className="btn-small border-amber-400 text-amber-600 shrink-0 disabled:opacity-30"
              aria-label="この給油場所をマイリストに保存"
            >
              ☆保存
            </button>
          </div>

          {myFuelLocations.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-gray-500 mb-2">よく使う給油先</p>
              <div className="flex flex-wrap gap-2">
                {myFuelLocations.map((fav) => (
                  <div
                    key={fav}
                    className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full pl-3 pr-1 py-1"
                  >
                    <button
                      type="button"
                      onClick={() => setFuelLocation(fav)}
                      className="text-sm text-amber-800 font-bold"
                    >
                      {fav}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMyFuelLocations(removeFavorite(MY_FUEL_LOCATIONS_KEY, fav, myFuelLocations))
                      }
                      className="text-gray-400 text-xs px-2 py-1"
                      aria-label="マイリストから削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label-text">給油量（L・任意）</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            className="input-field"
            placeholder="例：32.55"
            value={fuelAmount}
            onChange={(e) => setFuelAmount(e.target.value)}
          />
          {errors.fuelAmount && (
            <p className="text-red-600 font-bold mt-1">{errors.fuelAmount}</p>
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
            className="input-field min-h-[90px]"
            placeholder="必要があれば入力してください"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? "登録中..." : "登録する"}
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="btn-secondary flex-1"
          >
            入力をクリア
          </button>
        </div>
      </form>

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6 z-50">
          <div className="card max-w-sm w-full">
            <p className="text-lg font-bold text-gray-800 mb-2">入力中の内容をクリアしますか？</p>
            <p className="text-gray-500 mb-4">この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  clearForm();
                  setShowClearConfirm(false);
                }}
                className="btn-danger flex-1"
              >
                クリアする
              </button>
              <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <a href="/geppo" className="text-brand-600 font-bold underline underline-offset-4">
          月報を見る
        </a>
      </div>
    </main>
  );
}
