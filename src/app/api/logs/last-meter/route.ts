import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const vehicleId = Number(sp.get("vehicleId"));
  const excludeId = sp.get("excludeId") ? Number(sp.get("excludeId")) : undefined;

  if (!vehicleId || Number.isNaN(vehicleId)) {
    return NextResponse.json({ error: "vehicleIdは必須です" }, { status: 400 });
  }

  const lastLog = await prisma.vehicleLog.findFirst({
    where: { vehicleId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ lastMeter: lastLog ? lastLog.endMeter : null });
}
