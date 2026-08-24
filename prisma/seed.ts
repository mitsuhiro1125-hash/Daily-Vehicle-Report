import { PrismaClient } from "@prisma/client";
import { createSampleData } from "../src/lib/seedData";

const prisma = new PrismaClient();

async function main() {
  console.log("シードデータの投入を開始します...");
  await prisma.vehicleLog.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.department.deleteMany();
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
