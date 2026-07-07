"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import PageHeader from "@/components/PageHeader";
import { todayInputValue, joinDestinations } from "@/lib/utils";
import type { VehicleDTO, DriverDTO } from "@/lib/types";

type FormErrors = Partial<Record<"date" | "vehicleId" | "driverId" | "destination" | "endMeter", string>>;

export default function NippoPage() {
  const [vehicles, setVehicles] = useState<VehicleDTO[]>([]);
  const [drivers, setDrivers] = useState<DriverDTO[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  const [date, setDate] = useState(todayInputValue());
  const [vehicleId, setVehicleId] = useState<string>("");
  const [driverMode, setDriverMode] = useState<"select" | "manual">("select");
  const [driverId, setDriverId] = useState<string>("");
  const [driverManualName, setDriverManualName] = useState("");
  const [destinations, setDestinations] = useState<string[]>([""]);
  const [endMeter, setEndMeter] = useState<string>("");
  const [note, setNote] = useState("");

  const [lastMeter, setLastMeter] = useState<number | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 車両・運転者マスタを読み込む
  useEffect(() => {
    async function load() {
      setLoadingMasters(true);
      const [vRes, dRes] = await Promise.all([
        fetch("/api/vehicles"),
        fetch("/api/drivers"),
      ]);
      const vData: VehicleDTO[] = await vRes.json();
      const dData: DriverDTO[] = await dRes.json();
      setVehicles(vData);
      setDrivers(dData);
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

  function addDestinationField() {
    setDestinations((prev) => [...prev, ""]);
  }

  function removeDestinationField(index: number) {
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDestinationField(index: number, value: string) {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
  }

  function clearForm(keepVehicleAndDriver: boolean) {
    setDate(todayInputValue());
    if (!keepVehicleAndDriver) {
      setVehicleId("");
      setDriverId("");
      setDriverManualName("");
    }
    setDestinations([""]);
    setEndMeter("");
    setNote("");
    setErrors({});
    setSubmitError(null);
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!date) newErrors.date = "日付を入力してください";
    if (!vehicleId) newErrors.vehicleId = "車両を選択してください";

    if (driverMode === "select") {
      if (!driverId) newErrors.driverId = "運転者を選択してください";
    } else {
      if (!driverManualName.trim())
        newErrors.driverId = "運転者名を入力してください";
    }

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function resolveDriverId(): Promise<number | null> {
    if (driverMode === "select") {
      return Number(driverId);
    }
    // 手入力の場合は、同名の運転者がいれば流用、いなければ新規登録して使う
    const name = driverManualName.trim();
    const existing = drivers.find((d) => d.name === name);
    if (existing) return existing.id;

    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sortOrder: 999, isActive: true }),
    });
    if (!res.ok) return null;
    const created: DriverDTO = await res.json();
    setDrivers((prev) => [...prev, created]);
    return created.id;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
    setWarningMessage(null);
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const resolvedDriverId = await resolveDriverId();
      if (!resolvedDriverId) {
        setSubmitError("運転者の登録に失敗しました。もう一度お試しください。");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          vehicleId: Number(vehicleId),
          driverId: resolvedDriverId,
          destination: joinDestinations(destinations),
          endMeter: Number(endMeter),
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

      // 同じ車両・運転者で続けて入力しやすいよう、選択内容は維持してクリアする
      const keptVehicleId = vehicleId;
      const keptDriverId = driverId;
      const keptDriverMode = driverMode;
      const keptDriverManualName = driverManualName;
      clearForm(true);
      setVehicleId(keptVehicleId);
      setDriverMode(keptDriverMode);
      setDriverId(keptDriverId);
      setDriverManualName(keptDriverManualName);
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
            onChange={(e) => setVehicleId(e.target.value)}
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

        {/* 運転者 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label-text mb-0">運転者</label>
            <button
              type="button"
              onClick={() =>
                setDriverMode((m) => (m === "select" ? "manual" : "select"))
              }
              className="text-sm text-brand-600 underline underline-offset-4 font-bold"
            >
              {driverMode === "select" ? "名簿にない場合は直接入力" : "名簿から選ぶ"}
            </button>
          </div>
          {driverMode === "select" ? (
            <select
              className="input-field bg-white"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">選択してください</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="input-field"
              placeholder="運転者名を入力"
              value={driverManualName}
              onChange={(e) => setDriverManualName(e.target.value)}
            />
          )}
          {errors.driverId && (
            <p className="text-red-600 font-bold mt-1">{errors.driverId}</p>
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

        {/* 備考 */}
        <div>
          <label className="label-text">備考（任意）</label>
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
