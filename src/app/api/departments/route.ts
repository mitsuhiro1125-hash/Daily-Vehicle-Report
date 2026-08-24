import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";
  const departments = await prisma.department.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(departments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, sortOrder, isActive } = body ?? {};

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "所属名は必須です" }, { status: 400 });
  }

  const department = await prisma.department.create({
    data: {
      name: name.trim(),
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
  });

  return NextResponse.json(department, { status: 201 });
}
