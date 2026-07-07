"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import PageHeader from "@/components/PageHeader";
import { todayInputValue, joinDestinations } from "@/lib/utils";
import type { VehicleDTO } from "@/lib/types";

type FormErrors = Partial<Record<"date" | "vehicleId" | "destination" | "endMeter" | "fuelAmount", string>>;

// この端末（スマホ・パソコン）に、最後に選んだ車両を覚えておくためのキー
const LAST_VEHICLE_STORAGE_KEY = "vehicle-report:lastVehicleId";

export default function NippoPage() {
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  const [date, setDate] = useState(todayInputValue());
  const [vehicleId, setVehicleId] = useState<string>("");
  const [destinations, setDestinations] = useState<string[]>([""]);
  const [endMeter, setEndMeter] = useState<string>("");
  const [fuelLocation, setFuelLocation] = useState("");
  const [fuelAmount, setFuelAmount] = useState("");
  const [note, setNote] = useState("");

  const [lastMeter, setLastMeter] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 車両マスタを読み込み、この端末で前回選ばれていた車両があれば自動で選択する
  useEffect(() => {
    async function load() {
      setLoadingMasters(true);
      const res = await fetch("/api/vehicles");
      const data: VehicleDTO[] = await res.json();
      setVehicles(data);

      const remembered = window.localStorage.getItem(LAST_VEHICLE_STORAGE_KEY);
      if (remembered && data.some((v) => String(v.id) === remembered)) {
        setVehicleId(remembered);
      }
      setLoadingMasters(false);
    }
    load();
  }, []);

  // 選択中の車両が変わったら、前回の終業時メーターを取得して参考表示する
  const fetchLastMeter = useCallback(async (vId: string) => {
    if (!vId) {
      setLastMeter(null);
      return;
    }
    const res = await fetch(`/api/logs/last-meter?vehicleId=${vId}`);
    if (res.ok) {
      const data = await res.json();
      setLastMeter(typeof data.lastMeter === "number" ? data.lastMeter : null);
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

  function addDestinationField() {
    setDestinations((prev) => [...prev, ""]);
  }

  function removeDestinationField(index: number) {
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDestinationField(index: number, value: string) {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function clearForm(keepVehicle: boolean) {
    setDate(todayInputValue());
    if (!keepVehicle) {
      setVehicleId("");
    }
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
      if (Number.isNaN(n) || n < 0) {
        newErrors.endMeter = "0以上の数値を入力してください";
      }
    }

    if (fuelAmount !== "") {
      const n = Number(fuelAmount);
      if (Number.isNaN(n) || n < 0) {
        newErrors.fuelAmount = "0以上の数値を入力してください";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setWarningMessage(null);
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
        const data = await res.json();
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
      setSuccessMessage("登録しました");
      if (data.warning) setWarningMessage(data.warning);

      // 同じ車両で続けて入力しやすいよう、車両の選択は維持してクリアする
      const keptVehicleId = vehicleId;
      clearForm(true);
      setVehicleId(keptVehicleId);
      fetchLastMeter(keptVehicleId);
    } finally {
      setSubmitting(false);
    }
  }

  const enteredMeterNum = endMeter === "" ? null : Number(endMeter);
  const showMeterCaution =
    lastMeter !== null &&
    enteredMeterNum !== null &&
    !Number.isNaN(enteredMeterNum) &&
    enteredMeterNum < lastMeter;

  if (loadingMasters) {
    return (
      <main className="flex-1 px-6 py-6">
        <PageHeader title="日報を入力する" />
        <p className="text-gray-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-6 pb-16">
      <PageHeader title="日報を入力する" />

      {successMessage && (
        <div className="mb-5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-800 font-bold text-lg px-5 py-4">
          ✓ {successMessage}
          {warningMessage && (
            <div className="mt-2 text-amber-700 font-normal text-base">
              ⚠ {warningMessage}
            </div>
          )}
        </div>
      )}
      {submitError && (
        <div className="mb-5 rounded-xl bg-red-50 border-2 border-red-400 text-red-700 font-bold px-5 py-4">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card flex flex-col gap-6">
        {/* 日付 */}
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

        {/* 車両 */}
        <div>
          <label className="label-text">車両</label>
          <select
            className="input-field bg-white"
            value={vehicleId}
            onChange={(e) => handleVehicleChange(e.target.value)}
          >
            <option value="">選択してください</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {errors.vehicleId && (
            <p className="text-red-600 font-bold mt-1">{errors.vehicleId}</p>
          )}
        </div>

        {/* 訪問先 */}
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
        </div>

        {/* 終業時メーター */}
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
          {errors.endMeter && (
            <p className="text-red-600 font-bold mt-1">{errors.endMeter}</p>
          )}
        </div>

        {/* 給油場所 */}
        <div>
          <label className="label-text">給油場所（任意）</label>
          <input
            type="text"
            className="input-field"
            placeholder="例：ENEOS 目黒店"
            value={fuelLocation}
            onChange={(e) => setFuelLocation(e.target.value)}
          />
        </div>

        {/* 給油量 */}
        <div>
          <label className="label-text">給油量（L・任意）</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            className="input-field"
            placeholder="例：32.5"
            value={fuelAmount}
            onChange={(e) => setFuelAmount(e.target.value)}
          />
          {errors.fuelAmount && (
            <p className="text-red-600 font-bold mt-1">{errors.fuelAmount}</p>
          )}
        </div>

        {/* 備考 */}
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

        {/* 操作ボタン */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? "登録中..." : "登録する"}
          </button>
          <button
            type="button"
            onClick={() => clearForm(false)}
            className="btn-secondary flex-1"
          >
            入力をクリア
          </button>
        </div>
      </form>

      <div className="mt-6 text-center">
        <a href="/geppo" className="text-brand-600 font-bold underline underline-offset-4">
          月報を見る
        </a>
      </div>
    </main>
  );
}
