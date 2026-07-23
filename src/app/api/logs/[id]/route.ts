import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

type ValidationError = { field: string; message: string };

function validateLogInput(body: unknown): {
  errors: ValidationError[];
  data: {
    date: string;
    vehicleId: number;
    destination: string;
    endMeter: number;
    fuelLocation: string | null;
    fuelAmount: number | null;
    note: string | null;
  } | null;
} {
  const errors: ValidationError[] = [];
  const b = (body ?? {}) as Record<string, unknown>;

  const date = typeof b.date === "string" ? b.date : "";
  if (!date) errors.push({ field: "date", message: "日付は必須です" });

  const vehicleId = Number(b.vehicleId);
  if (!b.vehicleId || Number.isNaN(vehicleId)) {
    errors.push({ field: "vehicleId", message: "車両は必須です" });
  }

  const destination =
    typeof b.destination === "string" ? b.destination.trim() : "";
  if (!destination) {
    errors.push({ field: "destination", message: "訪問先は必須です" });
  }

  const endMeter = Number(b.endMeter);
  if (b.endMeter === undefined || b.endMeter === null || b.endMeter === "") {
    errors.push({ field: "endMeter", message: "終業時メーターは必須です" });
  } else if (Number.isNaN(endMeter) || endMeter < 0) {
    errors.push({
      field: "endMeter",
      message: "終業時メーターは0以上の数値で入力してください",
    });
  }

  let fuelAmount: number | null = null;
  if (b.fuelAmount !== undefined && b.fuelAmount !== null && b.fuelAmount !== "") {
    fuelAmount = Number(b.fuelAmount);
    if (Number.isNaN(fuelAmount) || fuelAmount < 0) {
      errors.push({
        field: "fuelAmount",
        message: "給油量は0以上の数値で入力してください",
      });
    }
  }

  if (errors.length > 0) return { errors, data: null };

  const note = typeof b.note === "string" && b.note.trim() !== "" ? b.note.trim() : null;
  const fuelLocation =
    typeof b.fuelLocation === "string" && b.fuelLocation.trim() !== ""
      ? b.fuelLocation.trim()
      : null;

  return {
    errors: [],
    data: { date, vehicleId, destination, endMeter, fuelLocation, fuelAmount, note },
  };
}

// PUT /api/logs/:id : 車両利用記録を更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
  }

  const body = await request.json();
  const { errors, data } = validateLogInput(body);
  if (errors.length > 0 || !data) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // 自分自身を除いた、同じ車両の直近メーター値を取得して警告判定に使う
  const lastLog = await prisma.vehicleLog.findFirst({
    where: { vehicleId: data.vehicleId, id: { not: id } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  try {
    const log = await prisma.vehicleLog.update({
      where: { id },
      data: {
        date: new Date(`${data.date}T00:00:00`),
        vehicleId: data.vehicleId,
        destination: data.destination,
        endMeter: data.endMeter,
        fuelLocation: data.fuelLocation,
        fuelAmount: data.fuelAmount,
        note: data.note,
      },
      include: { vehicle: true },
    });

    let warning: string | null = null;
    if (lastLog && data.endMeter < lastLog.endMeter) {
      warning = `前回登録時のメーター（${lastLog.endMeter.toLocaleString(
        "ja-JP"
      )} km）より小さい値です。入力内容をご確認ください。`;
    }

    return NextResponse.json({ log, warning });
  } catch {
    return NextResponse.json(
      { error: "対象の記録が見つかりません" },
      { status: 404 }
    );
  }
}

// DELETE /api/logs/:id : 車両利用記録を削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
  }

  try {
    await prisma.vehicleLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "対象の記録が見つかりません" },
      { status: 404 }
    );
  }
}
