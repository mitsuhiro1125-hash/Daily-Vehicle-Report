import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, toDateInputValue, yearMonthToRange, currentYearMonth } from "@/lib/utils";

// GET /api/logs/csv?yearMonth=YYYY-MM&vehicleId=&driverId=
// 月報一覧と同じ絞り込み条件でCSVを生成してダウンロードさせる
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth") || currentYearMonth();
  const vehicleId = sp.get("vehicleId");
  const driverId = sp.get("driverId");

  const where: {
    date?: { gte: Date; lte: Date };
    vehicleId?: number;
    driverId?: number;
  } = {};

  const { start, end } = yearMonthToRange(yearMonth);
  where.date = { gte: start, lte: end };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (driverId) where.driverId = Number(driverId);

  const logs = await prisma.vehicleLog.findMany({
    where,
    include: { vehicle: true, driver: true },
    orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { id: "asc" }],
  });

  const header = [
    "日付",
    "車両名",
    "車両番号",
    "運転者",
    "訪問先",
    "終業時メーター",
    "備考",
  ];

  const rows = logs.map((log) => {
    // 訪問先は改行区切りで保存しているため、CSVでは読点でつないで1セルにまとめる
    const destinationForCsv = log.destination.split("\n").join(" / ");
    return [
      toDateInputValue(log.date),
      log.vehicle.name,
      log.vehicle.number,
      log.driver.name,
      destinationForCsv,
      log.endMeter,
      log.note ?? "",
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
