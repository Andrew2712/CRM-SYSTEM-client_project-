import { PrismaClient, Role, PatientStatus, SessionType, AppointmentStatus } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("Seeding...");

  // Create users
  const adminPass = await bcrypt.hash("admin123", 10);
  const doctorPass = await bcrypt.hash("doctor123", 10);
  const receptionPass = await bcrypt.hash("reception123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@clinic.com" },
    update: {},
    create: { name: "Admin User", email: "admin@clinic.com", passwordHash: adminPass, role: Role.ADMIN },
  });

  const doctor = await prisma.user.upsert({
    where: { email: "dr.priya@clinic.com" },
    update: {},
    create: { name: "Dr. Priya Nair", email: "dr.priya@clinic.com", passwordHash: doctorPass, role: Role.DOCTOR },
  });

  const doctor2 = await prisma.user.upsert({
    where: { email: "dr.arun@clinic.com" },
    update: {},
    create: { name: "Dr. Arun Kumar", email: "dr.arun@clinic.com", passwordHash: doctorPass, role: Role.DOCTOR },
  });

  const receptionist = await prisma.user.upsert({
    where: { email: "reception@clinic.com" },
    update: {},
    create: { name: "Receptionist", email: "reception@clinic.com", passwordHash: receptionPass, role: Role.RECEPTIONIST },
  });

  // Create patients
  const patient1 = await prisma.patient.upsert({
    where: { patientCode: "PHY-2026-0001" },
    update: {},
    create: {
      patientCode: "PHY-2026-0001",
      name: "Rahul Sharma",
      phone: "+919876543210",
      email: "rahul@email.com",
      status: PatientStatus.RETURNING,
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { patientCode: "PHY-2026-0002" },
    update: {},
    create: {
      patientCode: "PHY-2026-0002",
      name: "Priya Patel",
      phone: "+918765432109",
      email: "priya@email.com",
      status: PatientStatus.NEW,
    },
  });

  const patient3 = await prisma.patient.upsert({
    where: { patientCode: "PHY-2026-0003" },
    update: {},
    create: {
      patientCode: "PHY-2026-0003",
      name: "Rohan Verma",
      phone: "+917654321098",
      email: "rohan@email.com",
      status: PatientStatus.RETURNING,
    },
  });

  // Create appointments
  await prisma.appointment.createMany({
    skipDuplicates: true,
    data: [
      {
        patientId: patient1.id,
        doctorId: doctor.id,
        startTime: new Date("2026-04-10T09:00:00"),
        endTime: new Date("2026-04-10T10:00:00"),
        sessionType: SessionType.FOLLOW_UP,
        status: AppointmentStatus.ATTENDED,
      },
      {
        patientId: patient2.id,
        doctorId: doctor.id,
        startTime: new Date("2026-04-10T10:00:00"),
        endTime: new Date("2026-04-10T11:00:00"),
        sessionType: SessionType.INITIAL_ASSESSMENT,
        status: AppointmentStatus.ATTENDED,
      },
      {
        patientId: patient3.id,
        doctorId: doctor.id,
        startTime: new Date("2026-04-10T14:00:00"),
        endTime: new Date("2026-04-10T15:00:00"),
        sessionType: SessionType.INITIAL_ASSESSMENT,
        status: AppointmentStatus.MISSED,
      },
      {
        patientId: patient1.id,
        doctorId: doctor.id,
        startTime: new Date("2026-04-14T09:00:00"),
        endTime: new Date("2026-04-14T10:00:00"),
        sessionType: SessionType.FOLLOW_UP,
        status: AppointmentStatus.CONFIRMED,
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log("Login credentials:");
  console.log("  Admin:       admin@clinic.com / admin123");
  console.log("  Doctor:      dr.priya@clinic.com / doctor123");
  console.log("  Reception:   reception@clinic.com / reception123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());