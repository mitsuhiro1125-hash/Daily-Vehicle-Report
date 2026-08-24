import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "不正なIDです" }, { status: 400 });

  const body = await request.json();
  const { name, number, departmentId, sortOrder, isActive } = body ?? {};

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "車両名は必須です" }, { status: 400 });
  }
  if (!number || typeof number !== "string" || number.trim() === "") {
    return NextResponse.json({ error: "車両番号は必須です" }, { status: 400 });
  }

  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        name: name.trim(),
        number: number.trim(),
        departmentId: typeof departmentId === "number" && Number.isInteger(departmentId) ? departmentId : null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
      include: { department: true },
    });
    return NextResponse.json(vehicle);
  } catch {
    return NextResponse.json({ error: "対象の車両が見つかりません" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "不正なIDです" }, { status: 400 });

  const usageCount = await prisma.vehicleLog.count({ where: { vehicleId: id } });
  if (usageCount > 0) {
    try {
      const vehicle = await prisma.vehicle.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        hidden: true,
        vehicle,
        message: "この車両には利用記録があるため削除できません。代わりに「非表示（使用停止）」にしました。",
      });
    } catch {
      return NextResponse.json({ error: "対象の車両が見つかりません" }, { status: 404 });
    }
  }

  try {
    await prisma.vehicle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "対象の車両が見つかりません" }, { status: 404 });
  }
}
