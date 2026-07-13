import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSampleData } from "@/lib/seedData";

// GET /api/admin/seed?key=シークレットキー
// クラウド公開後、最初の1回だけブラウザで開いてサンプルデータを投入するための特別なAPI。
// 安全のため、
// ・環境変数 SEED_SECRET と一致するキーが指定されないと動かない
// ・すでに車両か運転者のデータが1件でもあれば、何もせず終了する（誤操作でのデータ消失を防ぐ）
export async function GET(request: NextRequest) {
  const secret = process.env.SEED_SECRET;
  const key = request.nextUrl.searchParams.get("key");

  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRETが設定されていません。環境変数を設定してください。" },
      { status: 500 }
    );
  }

  if (!key || key !== secret) {
    return NextResponse.json({ error: "キーが正しくありません。" }, { status: 403 });
  }

  const vehicleCount = await prisma.vehicle.count();

  if (vehicleCount > 0) {
    return NextResponse.json({
      message: "すでにデータが存在するため、何もしませんでした。",
    });
  }

  await createSampleData(prisma);

  return NextResponse.json({ message: "サンプルデータの投入が完了しました。" });
}
