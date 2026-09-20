/*
  Warnings:

  - You are about to drop the column `isReadByTenant` on the `PaymentProof` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConditionPhoto" DROP CONSTRAINT "ConditionPhoto_reportId_fkey";

-- DropForeignKey
ALTER TABLE "ConditionReport" DROP CONSTRAINT "ConditionReport_tenancyId_fkey";

-- AlterTable
ALTER TABLE "PaymentProof" DROP COLUMN "isReadByTenant";

-- AddForeignKey
ALTER TABLE "ConditionReport" ADD CONSTRAINT "ConditionReport_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionPhoto" ADD CONSTRAINT "ConditionPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConditionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
