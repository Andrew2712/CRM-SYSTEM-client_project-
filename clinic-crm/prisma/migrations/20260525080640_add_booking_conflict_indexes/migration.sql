/*
  Warnings:

  - The values [WAITLIST_SLOT_AVAILABLE,WAITLIST_BOOKED,WAITLIST_EXPIRED] on the enum `InAppNotifType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Waitlist` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InAppNotifType_new" AS ENUM ('APPOINTMENT_CREATED', 'APPOINTMENT_MISSED', 'SESSION_COMPLETED', 'SYSTEM', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED', 'DOCTOR_REASSIGNED', 'HOLIDAY_REQUEST', 'REASSIGNMENT_REQUEST');
ALTER TABLE "InAppNotification" ALTER COLUMN "type" TYPE "InAppNotifType_new" USING ("type"::text::"InAppNotifType_new");
ALTER TYPE "InAppNotifType" RENAME TO "InAppNotifType_old";
ALTER TYPE "InAppNotifType_new" RENAME TO "InAppNotifType";
DROP TYPE "public"."InAppNotifType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Waitlist" DROP CONSTRAINT "Waitlist_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "Waitlist" DROP CONSTRAINT "Waitlist_patientId_fkey";

-- DropTable
DROP TABLE "Waitlist";

-- DropEnum
DROP TYPE "WaitlistStatus";

-- CreateIndex
CREATE INDEX "Appointment_doctorId_startTime_endTime_idx" ON "Appointment"("doctorId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_status_idx" ON "Appointment"("doctorId", "status");
