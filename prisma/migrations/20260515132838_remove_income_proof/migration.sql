/*
  Warnings:

  - You are about to drop the column `faceMatchScore` on the `KycSubmission` table. All the data in the column will be lost.
  - You are about to drop the `TenantDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TenantDocument" DROP CONSTRAINT "TenantDocument_userId_fkey";

-- AlterTable
ALTER TABLE "KycSubmission" DROP COLUMN "faceMatchScore";

-- DropTable
DROP TABLE "TenantDocument";

-- DropEnum
DROP TYPE "DocumentType";
