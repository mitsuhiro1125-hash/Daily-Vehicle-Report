import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  csvEscape,
  toDateInputValue,
  yearMonthToRange,
  currentYearMonth,
  daysInYearMonth,
} from "@/lib/utils";

// GET /api/logs/csv?yearMonth=YYYY-MM&vehicleId=
// 月報一覧と同じ絞り込み条件でCSVを生成してダウンロードさせる
// 出力項目：日付・訪問先・終業時メーター・給油場所・給油量・給油金額・日（数字）・備考
//
// 社内で使っている「運転日報」Excelシートにそのまま転記できるように、
// 以下の仕様にしている。
// ・1列目の「日付」は通常の日付表記（YYYY-MM-DD）
// ・「給油金額」と「備考」の間に、日番号のみの列（1〜31）をもう1つ追加
//   （Excel側で「給油場所」から右をまとめて貼り付けるときの目印用）
// ・実際に入力された日だけでなく、月の全日を出力し、入力のない日は空欄の行にする
// ・給油金額は入力画面には存在しない列だが、Excel側で手入力できるよう常に空欄で出力する
// ・備考は登録された内容をそのまま出力する
// ・同じ日に複数回入力がある場合は、1日1行にまとめる
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth") || currentYearMonth();
  const vehicleIdParam = sp.get("vehicleId");

  const { start, end } = yearMonthToRange(yearMonth);
  const days = daysInYearMonth(yearMonth);

  const header = [
    "日付",
    "訪問先",
    "終業時メーター",
    "給油場所",
    "給油量",
    "給油金額",
    "日",
    "備考",
  ];

  // "YYYY-MM-DD" → "1"〜"31"（先頭ゼロなしの日番号）に変換
  function toDayNumber(dateStr: string): string {
    const dayPart = dateStr.split("-")[2] ?? "";
    return String(Number(dayPart));
  }

  function logsToRowsForDay(
    dateStr: string,
    logsOnDay: {
      destination: string;
      endMeter: number;
      fuelLocation: string | null;
      fuelAmount: number | null;
      note: string | null;
    }[]
  ): string {
    const dayNumber = toDayNumber(dateStr);

    if (logsOnDay.length === 0) {
      // 入力のない日は、日付・日番号だけ入れて他は空欄の行にする
      return [dateStr, "", "", "", "", "", dayNumber, ""].map(csvEscape).join(",");
    }

    // 同じ日に複数回入力がある場合は、1日1行にまとめる
    const allDestinations = logsOnDay.flatMap((log) =>
      log.destination.split("\n").map((s) => s.trim()).filter((s) => s.length > 0)
    );
    const destinationForCsv = allDestinations.join("、");

    const endMeter = Math.max(...logsOnDay.map((log) => log.endMeter));

    const fuelLocations = logsOnDay.map((log) => log.fuelLocation).filter((v): v is string => !!v);
    const fuelLocationForCsv = fuelLocations.join("、");

    const fuelAmounts = logsOnDay
      .map((log) => log.fuelAmount)
      .filter((v): v is number => v !== null && v !== undefined);
    const fuelAmountForCsv = fuelAmounts.length > 0 ? fuelAmounts.reduce((a, b) => a + b, 0) : "";

    const notes = logsOnDay.map((log) => log.note).filter((v): v is string => !!v);
    const noteForCsv = notes.join(" ／ ");

    return [
      dateStr,
      destinationForCsv,
      endMeter,
      fuelLocationForCsv,
      fuelAmountForCsv,
      "", // 給油金額（常に空欄）
      dayNumber,
      noteForCsv,
    ]
      .map(csvEscape)
      .join(",");
  }

  const blocks: string[] = [];

  if (vehicleIdParam) {
    // 車両を1台に絞り込んでいる場合：その車両の全日分を出力する
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: Number(vehicleIdParam) },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "対象の車両が見つかりません" }, { status: 404 });
    }

    const logs = await prisma.vehicleLog.findMany({
      where: { vehicleId: vehicle.id, date: { gte: start, lte: end } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const logsByDate = new Map<string, typeof logs>();
    for (const log of logs) {
      const key = toDateInputValue(log.date);
      const arr = logsByDate.get(key) ?? [];
      arr.push(log);
      logsByDate.set(key, arr);
    }

    const rows = days.map((day) => logsToRowsForDay(day, logsByDate.get(day) ?? []));
    blocks.push([header.map(csvEscape).join(","), ...rows].join("\r\n"));
  } else {
    // 車両を絞り込んでいない場合：月内に記録のある車両ごとに、それぞれ全日分を出力する
    const logs = await prisma.vehicleLog.findMany({
      where: { date: { gte: start, lte: end } },
      include: { vehicle: true },
      orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { id: "asc" }],
    });

    const byVehicle = new Map<
      number,
      { name: string; number: string; logsByDate: Map<string, typeof logs> }
    >();
    for (const log of logs) {
      let entry = byVehicle.get(log.vehicleId);
      if (!entry) {
        entry = { name: log.vehicle.name, number: log.vehicle.number, logsByDate: new Map() };
        byVehicle.set(log.vehicleId, entry);
      }
      const key = toDateInputValue(log.date);
      const arr = entry.logsByDate.get(key) ?? [];
      arr.push(log);
      entry.logsByDate.set(key, arr);
    }

    for (const [, vehicleEntry] of byVehicle) {
      const titleLine = csvEscape(`■ ${vehicleEntry.name}（${vehicleEntry.number}）`);
      const rows = days.map((day) =>
        logsToRowsForDay(day, vehicleEntry.logsByDate.get(day) ?? [])
      );
      blocks.push([titleLine, header.map(csvEscape).join(","), ...rows].join("\r\n"));
    }
  }

  const csvBody = blocks.join("\r\n\r\n");
  // Excelで文字化けしないようUTF-8 BOMを付与
  const csvWithBom = "\uFEFF" + csvBody;

  const filename = `vehicle-monthly-report_${yearMonth}.csv`;

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
