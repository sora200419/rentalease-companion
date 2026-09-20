-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_REVIEW', 'CORRECTION_REQUESTED', 'COUNTER_EVIDENCE_ADDED', 'ACCEPTED', 'DISPUTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('ACCEPTED', 'CORRECTION_REQUESTED', 'COUNTER_EVIDENCE_ADDED');

-- CreateEnum
CREATE TYPE "ChecklistCompletionReason" AS ENUM ('PHOTO_UPLOADED', 'NO_ISSUE_OBSERVED', 'NOT_APPLICABLE', 'CANNOT_ACCESS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONDITION_REPORT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONDITION_REPORT_CORRECTION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONDITION_REPORT_COUNTER_EVIDENCE';
ALTER TYPE "NotificationType" ADD VALUE 'CONDITION_REPORT_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'CONDITION_REPORT_DISPUTED';

-- AlterTable
ALTER TABLE "ConditionReport" ADD COLUMN     "correctionNote" TEXT,
ADD COLUMN     "counterNote" TEXT,
ADD COLUMN     "reviewDecision" "ReviewDecision",
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EvidenceChecklistItem" (
    "id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "completionReason" "ChecklistCompletionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reportId" TEXT NOT NULL,

    CONSTRAINT "EvidenceChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceChecklistItem_reportId_area_key" ON "EvidenceChecklistItem"("reportId", "area");

-- AddForeignKey
ALTER TABLE "ConditionReport" ADD CONSTRAINT "ConditionReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceChecklistItem" ADD CONSTRAINT "EvidenceChecklistItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConditionReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing acknowledged reports → ACCEPTED status
UPDATE "ConditionReport"
SET
  status = 'ACCEPTED',
  "reviewDecision" = 'ACCEPTED',
  "reviewedAt" = "acknowledgedAt",
  "reviewedById" = "acknowledgedById"
WHERE "acknowledgedAt" IS NOT NULL;

-- Reports with photos but not yet acknowledged → SUBMITTED
UPDATE "ConditionReport"
SET status = 'SUBMITTED'
WHERE "acknowledgedAt" IS NULL
  AND id IN (
    SELECT DISTINCT "reportId" FROM "ConditionPhoto"
  );
-- Reports with no photos remain DRAFT (already set by DEFAULT)
