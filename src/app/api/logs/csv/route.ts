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
// 出力項目：日付・訪問先・終業時メーター・給油場所・給油量
//
// 「月末の月報にそのままコピペできるように」という要望に合わせて、
// 実際に入力された日だけでなく、月の全日（例：7月なら7/1〜7/31）を出力し、
// 入力のない日は空欄の行として出力する。
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth") || currentYearMonth();
  const vehicleIdParam = sp.get("vehicleId");

  const { start, end } = yearMonthToRange(yearMonth);
  const days = daysInYearMonth(yearMonth);

  const header = ["日付", "訪問先", "終業時メーター", "給油場所", "給油量"];

  function logsToRowsForDay(
    dateStr: string,
    logsOnDay: {
      destination: string;
      endMeter: number;
      fuelLocation: string | null;
      fuelAmount: number | null;
    }[]
  ): string {
    if (logsOnDay.length === 0) {
      // 入力のない日は、日付だけ入れて他は空欄の行にする
      return [csvEscape(dateStr), "", "", "", ""].join(",");
    }
    return logsOnDay
      .map((log) => {
        const destinationForCsv = log.destination.split("\n").join("、");
        return [
          dateStr,
          destinationForCsv,
          log.endMeter,
          log.fuelLocation ?? "",
          log.fuelAmount ?? "",
        ]
          .map(csvEscape)
          .join(",");
      })
      .join("\r\n");
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
