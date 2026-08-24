import { PrismaClient } from "@prisma/client";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

export async function createSampleData(prisma: PrismaClient) {
  const dept1 = await prisma.department.create({ data: { name: "本社", sortOrder: 1, isActive: true } });
  const dept2 = await prisma.department.create({ data: { name: "西営業所", sortOrder: 2, isActive: true } });

  const vehicle1 = await prisma.vehicle.create({
    data: { name: "営業車1号", number: "品川300 あ 12-34", departmentId: dept1.id, sortOrder: 1, isActive: true },
  });
  const vehicle2 = await prisma.vehicle.create({
    data: { name: "営業車2号", number: "品川300 あ 56-78", departmentId: dept1.id, sortOrder: 2, isActive: true },
  });
  const vehicle3 = await prisma.vehicle.create({
    data: { name: "軽トラック1号", number: "品川480 い 90-12", departmentId: dept2.id, sortOrder: 3, isActive: true },
  });

  await prisma.vehicleLog.create({
    data: { date: daysAgo(4), vehicleId: vehicle1.id, destination: "株式会社サンプル商事\n本社倉庫", endMeter: 12050, note: "納品対応" },
  });
  await prisma.vehicleLog.create({
    data: { date: daysAgo(3), vehicleId: vehicle1.id, destination: "取引先A社", endMeter: 12180, note: null },
  });
  await prisma.vehicleLog.create({
    data: { date: daysAgo(2), vehicleId: vehicle2.id, destination: "北支店\n南支店\n展示会場", endMeter: 8420, note: "展示会準備のため終業が遅くなりました" },
  });
  await prisma.vehicleLog.create({
    data: { date: daysAgo(1), vehicleId: vehicle3.id, destination: "資材センター", endMeter: 5310, note: "" },
  });
  await prisma.vehicleLog.create({
    data: { date: daysAgo(0), vehicleId: vehicle1.id, destination: "取引先B社\n取引先C社", endMeter: 12305, note: null },
  });
}
