import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // First create new doctor
  const hash = await bcrypt.hash("doctor123", 10);
  const newDoctor = await prisma.user.upsert({
    where: { email: "dr.sayalee@clinic.com" },
    update: {},
    create: {
      name: "Dr. Sayalee Pethe",
      email: "dr.sayalee@clinic.com",
      passwordHash: hash,
      role: "DOCTOR",
    },
  });
  console.log("✅ Dr. Sayalee Pethe created");

  // Reassign all appointments from old doctors to new doctor
  const oldDoctors = await prisma.user.findMany({
    where: { email: { in: ["dr.priya@clinic.com", "dr.arun@clinic.com"] } }
  });

  for (const old of oldDoctors) {
    await prisma.appointment.updateMany({
      where: { doctorId: old.id },
      data: { doctorId: newDoctor.id },
    });
    await prisma.patientVisit.updateMany({
      where: { doctorId: old.id },
      data: { doctorId: newDoctor.id },
    });
    console.log(`✅ Reassigned appointments from ${old.name}`);
  }

  // Now safe to delete old doctors
  await prisma.user.deleteMany({
    where: { email: { in: ["dr.priya@clinic.com", "dr.arun@clinic.com"] } }
  });
  console.log("✅ Old doctors removed");

  console.log("\n✅ Done!");
  console.log("Login: dr.sayalee@clinic.com / doctor123");
}

main().catch(console.error).finally(() => prisma.$disconnect());