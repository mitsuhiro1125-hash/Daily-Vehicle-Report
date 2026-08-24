import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape, toDateInputValue, yearMonthToRange, currentYearMonth, daysInYearMonth } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const yearMonth = sp.get("yearMonth") || currentYearMonth();
  const vehicleIdParam = sp.get("vehicleId");

  const { start, end } = yearMonthToRange(yearMonth);
  const days = daysInYearMonth(yearMonth);

  const header = ["日付", "訪問先", "終業時メーター", "給油場所", "給油量", "給油金額", "日", "備考"];

  function toDayNumber(dateStr: string): string {
    const dayPart = dateStr.split("-")[2] ?? "";
    return String(Number(dayPart));
  }

  function logsToRowsForDay(
    dateStr: string,
    logsOnDay: { destination: string; endMeter: number; fuelLocation: string | null; fuelAmount: number | null; note: string | null }[]
  ): string {
    const dayNumber = toDayNumber(dateStr);
    if (logsOnDay.length === 0) {
      return [dateStr, "", "", "", "", "", dayNumber, ""].map(csvEscape).join(",");
    }

    const allDestinations = logsOnDay.flatMap((log) =>
      log.destination.split("\n").map((s) => s.trim()).filter((s) => s.length > 0)
    );
    const destinationForCsv = allDestinations.join("、");
    const endMeter = Math.max(...logsOnDay.map((log) => log.endMeter));
    const fuelLocations = logsOnDay.map((log) => log.fuelLocation).filter((v): v is string => !!v);
    const fuelLocationForCsv = fuelLocations.join("、");
    const fuelAmounts = logsOnDay.map((log) => log.fuelAmount).filter((v): v is number => v !== null && v !== undefined);
    const fuelAmountForCsv = fuelAmounts.length > 0 ? fuelAmounts.reduce((a, b) => a + b, 0) : "";
    const notes = logsOnDay.map((log) => log.note).filter((v): v is string => !!v);
    const noteForCsv = notes.join(" ／ ");

    return [dateStr, destinationForCsv, endMeter, fuelLocationForCsv, fuelAmountForCsv, "", dayNumber, noteForCsv]
      .map(csvEscape)
      .join(",");
  }

  const blocks: string[] = [];

  if (vehicleIdParam) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(vehicleIdParam) } });
    if (!vehicle) return NextResponse.json({ error: "対象の車両が見つかりません" }, { status: 404 });

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
    const logs = await prisma.vehicleLog.findMany({
      where: { date: { gte: start, lte: end } },
      include: { vehicle: true },
      orderBy: [{ vehicleId: "asc" }, { date: "asc" }, { id: "asc" }],
    });

    const byVehicle = new Map<number, { name: string; number: string; logsByDate: Map<string, typeof logs> }>();
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
      const rows = days.map((day) => logsToRowsForDay(day, vehicleEntry.logsByDate.get(day) ?? []));
      blocks.push([titleLine, header.map(csvEscape).join(","), ...rows].join("\r\n"));
    }
  }

  const csvBody = blocks.join("\r\n\r\n");
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
