import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/logs/last-meter?vehicleId=X&excludeId=Y
// 指定した車両の直近の終業時メーターを返す（日報入力画面の参考表示・注意喚起用）
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const vehicleId = Number(sp.get("vehicleId"));
  const excludeId = sp.get("excludeId") ? Number(sp.get("excludeId")) : undefined;

  if (!vehicleId || Number.isNaN(vehicleId)) {
    return NextResponse.json({ error: "vehicleIdは必須です" }, { status: 400 });
  }

  const lastLog = await prisma.vehicleLog.findFirst({
    where: {
      vehicleId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ lastMeter: lastLog ? lastLog.endMeter : null });
}
