/*
  Warnings:

  - You are about to drop the column `actorId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `description` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entity` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userName` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userRole` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PASSWORD_RESET', 'ROLE_CHANGE');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "actorId",
DROP COLUMN "entityType",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "entity" TEXT NOT NULL,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "newValue" JSONB,
ADD COLUMN     "oldValue" JSONB,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "userName" TEXT NOT NULL,
ADD COLUMN     "userRole" TEXT NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
