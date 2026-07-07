import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, toDateInputValue, yearMonthToRange, currentYearMonth } from "@/lib/utils";

// GET /api/logs/csv?yearMonth=YYYY-MM&vehicleId=
// 月報一覧と同じ絞り込み条件でCSVを生成してダウンロードさせる
// 出力項目：日付・訪問先・終業時メーター・給油場所・給油量
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth") || currentYearMonth();
  const vehicleId = sp.get("vehicleId");

  const where: {
    date?: { gte: Date; lte: Date };
    vehicleId?: number;
  } = {};

  const { start, end } = yearMonthToRange(yearMonth);
  where.date = { gte: start, lte: end };
  if (vehicleId) where.vehicleId = Number(vehicleId);

  const logs = await prisma.vehicleLog.findMany({
    where,
    include: { vehicle: true },
    orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { id: "asc" }],
  });

  const header = ["日付", "訪問先", "終業時メーター", "給油場所", "給油量"];

  const rows = logs.map((log) => {
    // 訪問先は改行区切りで保存しているため、CSVでは「、」でつないで1セルにまとめる
    const destinationForCsv = log.destination.split("\n").join("、");
    return [
      toDateInputValue(log.date),
      destinationForCsv,
      log.endMeter,
      log.fuelLocation ?? "",
      log.fuelAmount ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });

  const csvBody = [header.map(csvEscape).join(","), ...rows].join("\r\n");
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
