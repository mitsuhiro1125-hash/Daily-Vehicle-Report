// 開発確認用の初期データを投入するスクリプト（ローカルのみ）
// 実行: npm run db:seed
// 既存のデータを一旦すべて削除してから、サンプルデータを作り直します。

import { PrismaClient } from "@prisma/client";
import { createSampleData } from "../src/lib/seedData";

const prisma = new PrismaClient();

async function main() {
  console.log("シードデータの投入を開始します...");

  // 既存データを一旦クリア（順序に注意：外部キー制約のため logs から削除）
  await prisma.vehicleLog.deleteMany();
  await prisma.vehicle.deleteMany();

  await createSampleData(prisma);

  console.log("シードデータの投入が完了しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
