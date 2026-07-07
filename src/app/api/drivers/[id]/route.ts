import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// PUT /api/drivers/:id : 運転者情報を更新
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
  }

  const body = await request.json();
  const { name, sortOrder, isActive } = body ?? {};

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "氏名は必須です" },
      { status: 400 }
    );
  }

  try {
    const driver = await prisma.driver.update({
      where: { id },
      data: {
        name: name.trim(),
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });
    return NextResponse.json(driver);
  } catch {
    return NextResponse.json(
      { error: "対象の運転者が見つかりません" },
      { status: 404 }
    );
  }
}

// DELETE /api/drivers/:id : 運転者を削除
// 利用記録が既に存在する場合は削除できない（データ不整合防止）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
  }

  const usageCount = await prisma.vehicleLog.count({ where: { driverId: id } });
  if (usageCount > 0) {
    return NextResponse.json(
      {
        error:
          "この運転者は利用記録があるため削除できません。「使用停止」に変更してください。",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.driver.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "対象の運転者が見つかりません" },
      { status: 404 }
    );
  }
}
