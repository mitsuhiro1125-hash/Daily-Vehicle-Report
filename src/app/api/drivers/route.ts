import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/drivers : 運転者一覧を取得（表示順→名前順）
// includeInactive=1 を付けると使用停止の運転者も含める
export async function GET(request: NextRequest) {
  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "1";

  const drivers = await prisma.driver.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return NextResponse.json(drivers);
}

// POST /api/drivers : 運転者を新規登録
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, sortOrder, isActive } = body ?? {};

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "氏名は必須です" },
      { status: 400 }
    );
  }

  const driver = await prisma.driver.create({
    data: {
      name: name.trim(),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json(driver, { status: 201 });
}
