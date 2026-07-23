import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// PUT /api/departments/:id : 所属情報を更新
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
      { error: "所属名は必須です" },
      { status: 400 }
    );
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        name: name.trim(),
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });
    return NextResponse.json(department);
  } catch {
    return NextResponse.json(
      { error: "対象の所属が見つかりません" },
      { status: 404 }
    );
  }
}

// DELETE /api/departments/:id : 所属を削除
// 所属している車両が既に存在する場合は、削除の代わりに使用停止（非表示）にする
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "不正なIDです" }, { status: 400 });
  }

  const usageCount = await prisma.vehicle.count({ where: { departmentId: id } });
  if (usageCount > 0) {
    try {
      const department = await prisma.department.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        hidden: true,
        department,
        message:
          "この所属には車両が紐づいているため削除できません。代わりに「非表示（使用停止）」にしました。",
      });
    } catch {
      return NextResponse.json(
        { error: "対象の所属が見つかりません" },
        { status: 404 }
      );
    }
  }

  try {
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "対象の所属が見つかりません" },
      { status: 404 }
    );
  }
}
