import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vehicles : 車両一覧を取得（表示順→名前順）
// includeInactive=1 を付けると使用停止の車両も含める
export async function GET(request: NextRequest) {
  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "1";

  const vehicles = await prisma.vehicle.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { department: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(vehicles);
}

// POST /api/vehicles : 車両を新規登録
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, number, departmentId, sortOrder, isActive } = body ?? {};

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "車両名は必須です" },
      { status: 400 }
    );
  }
  if (!number || typeof number !== "string" || number.trim() === "") {
    return NextResponse.json(
      { error: "車両番号は必須です" },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      name: name.trim(),
      number: number.trim(),
      departmentId:
        typeof departmentId === "number" && Number.isInteger(departmentId)
          ? departmentId
          : null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
    include: { department: true },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
