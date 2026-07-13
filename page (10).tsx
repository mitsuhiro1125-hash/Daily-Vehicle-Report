import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { yearMonthToRange } from "@/lib/utils";

// GET /api/logs?yearMonth=YYYY-MM&vehicleId=
// 月報一覧向けに、絞り込み条件付きで利用記録を取得する
// 車両別に見やすいよう「車両ID → 日付」の順で並べる
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth");
  const vehicleId = sp.get("vehicleId");

  const where: {
    date?: { gte: Date; lte: Date };
    vehicleId?: number;
  } = {};

  if (yearMonth) {
    const { start, end } = yearMonthToRange(yearMonth);
    where.date = { gte: start, lte: end };
  }
  if (vehicleId) where.vehicleId = Number(vehicleId);

  const logs = await prisma.vehicleLog.findMany({
    where,
    include: { vehicle: true },
    orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(logs);
}

// バリデーション結果の型
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

  // 給油場所・給油量は任意項目
  const fuelLocation =
    typeof b.fuelLocation === "string" && b.fuelLocation.trim() !== ""
      ? b.fuelLocation.trim()
      : null;

  let fuelAmount: number | null = null;
  if (b.fuelAmount !== undefined && b.fuelAmount !== null && b.fuelAmount !== "") {
    const n = Number(b.fuelAmount);
    if (Number.isNaN(n) || n < 0) {
      errors.push({
        field: "fuelAmount",
        message: "給油量は0以上の数値で入力してください",
      });
    } else {
      fuelAmount = n;
    }
  }

  if (errors.length > 0) return { errors, data: null };

  const note = typeof b.note === "string" && b.note.trim() !== "" ? b.note.trim() : null;

  return {
    errors: [],
    data: { date, vehicleId, destination, endMeter, fuelLocation, fuelAmount, note },
  };
}

// POST /api/logs : 車両利用記録を新規登録
// 同じ車両の直近メーターより小さい値の場合は警告を返すが、登録自体は許可する
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { errors, data } = validateLogInput(body);

  if (errors.length > 0 || !data) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // 直近（同じ車両で最新の日付）のメーター値を取得して警告判定に使う
  const lastLog = await prisma.vehicleLog.findFirst({
    where: { vehicleId: data.vehicleId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const log = await prisma.vehicleLog.create({
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

  return NextResponse.json({ log, warning }, { status: 201 });
}
