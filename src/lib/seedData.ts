// サンプルデータ（初期データ）を作成する共通処理
// - ローカル開発用の prisma/seed.ts（既存データを削除してから作り直す）
// - クラウド公開後に1回だけ使う /api/admin/seed（データが空のときだけ作る）
// の両方から呼び出す

import { PrismaClient } from "@prisma/client";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

export async function createSampleData(prisma: PrismaClient) {
  const vehicle1 = await prisma.vehicle.create({
    data: { name: "営業車1号", number: "品川300 あ 12-34", sortOrder: 1, isActive: true },
  });
  const vehicle2 = await prisma.vehicle.create({
    data: { name: "営業車2号", number: "品川300 あ 56-78", sortOrder: 2, isActive: true },
  });
  const vehicle3 = await prisma.vehicle.create({
    data: { name: "軽トラック1号", number: "品川480 い 90-12", sortOrder: 3, isActive: true },
  });

  const driverYamada = await prisma.driver.create({
    data: { name: "山田", sortOrder: 1, isActive: true },
  });
  const driverTanaka = await prisma.driver.create({
    data: { name: "田中", sortOrder: 2, isActive: true },
  });
  const driverSato = await prisma.driver.create({
    data: { name: "佐藤", sortOrder: 3, isActive: true },
  });

  await prisma.vehicleLog.create({
    data: {
      date: daysAgo(4),
      vehicleId: vehicle1.id,
      driverId: driverYamada.id,
      destination: "株式会社サンプル商事\n本社倉庫",
      endMeter: 12050,
      note: "納品対応",
    },
  });
  await prisma.vehicleLog.create({
    data: {
      date: daysAgo(3),
      vehicleId: vehicle1.id,
      driverId: driverTanaka.id,
      destination: "取引先A社",
      endMeter: 12180,
      note: null,
    },
  });
  await prisma.vehicleLog.create({
    data: {
      date: daysAgo(2),
      vehicleId: vehicle2.id,
      driverId: driverSato.id,
      destination: "北支店\n南支店\n展示会場",
      endMeter: 8420,
      note: "展示会準備のため終業が遅くなりました",
    },
  });
  await prisma.vehicleLog.create({
    data: {
      date: daysAgo(1),
      vehicleId: vehicle3.id,
      driverId: driverYamada.id,
      destination: "資材センター",
      endMeter: 5310,
      note: "",
    },
  });
  await prisma.vehicleLog.create({
    data: {
      date: daysAgo(0),
      vehicleId: vehicle1.id,
      driverId: driverYamada.id,
      destination: "取引先B社\n取引先C社",
      endMeter: 12305,
      note: null,
    },
  });
}
