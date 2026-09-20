-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('IC_COPY', 'INCOME_PROOF');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PROPOSED', 'IN_REVIEW', 'AGREED', 'DISPUTED', 'PAID');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISPUTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DEPOSIT_DEDUCTION_FILED';
ALTER TYPE "NotificationType" ADD VALUE 'DEPOSIT_REFUND_PAID';
ALTER TYPE "NotificationType" ADD VALUE 'TENANCY_ENDING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'MUTUAL_TERMINATION_PROPOSED';
ALTER TYPE "NotificationType" ADD VALUE 'MUTUAL_TERMINATION_RESPONDED';

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "plainLanguageSummaryMs" TEXT,
ADD COLUMN     "redFlagsMs" TEXT;

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN     "renewalOfTenancyId" TEXT,
ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminatedReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "AgreementPreferences" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "petsPolicy" TEXT NOT NULL,
    "petsMaxCount" INTEGER,
    "petsDeposit" DECIMAL(10,2),
    "smokingPolicy" TEXT NOT NULL,
    "overnightGuests" TEXT NOT NULL,
    "overnightMaxNights" INTEGER,
    "quietHoursPolicy" TEXT NOT NULL,
    "quietHoursCustom" TEXT,
    "additionalHouseRules" TEXT,
    "utilityPaymentMethod" TEXT NOT NULL,
    "utilityDisputeMethod" TEXT NOT NULL,
    "internetProvider" TEXT,
    "internetAccountManager" TEXT,
    "acServicing" TEXT NOT NULL,
    "pestControl" TEXT NOT NULL,
    "rentDueDay" INTEGER NOT NULL,
    "gracePeriodDays" INTEGER NOT NULL,
    "latePenaltyType" TEXT NOT NULL,
    "latePenaltyAmount" DECIMAL(10,2),
    "acceptablePaymentMethods" TEXT NOT NULL,
    "rentIncreaseTerms" TEXT NOT NULL,
    "rentIncreasePercent" DECIMAL(5,2),
    "minorRepairThreshold" DECIMAL(10,2) NOT NULL,
    "minorRepairResponsible" TEXT NOT NULL,
    "plumbingResponsible" TEXT NOT NULL,
    "electricalResponsible" TEXT NOT NULL,
    "applianceResponsible" TEXT NOT NULL,
    "structuralResponsible" TEXT NOT NULL,
    "urgentResponseTime" TEXT NOT NULL,
    "tenantNoticeMonths" INTEGER NOT NULL,
    "landlordNoticeMonths" INTEGER NOT NULL,
    "earlyTerminationPenalty" TEXT NOT NULL,
    "earlyTerminationMonths" INTEGER,
    "reinstatementLevel" TEXT NOT NULL,
    "sublettingPolicy" TEXT NOT NULL,
    "depositRefundDays" INTEGER NOT NULL,
    "deductionCategories" TEXT NOT NULL,
    "disputeResolution" TEXT NOT NULL,
    "utilityDepositHandling" TEXT NOT NULL,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositRefund" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "originalAmount" DECIMAL(10,2) NOT NULL,
    "refundAmount" DECIMAL(10,2) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PROPOSED',
    "paidProofUrl" TEXT,
    "paidProofPublicId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositDeduction" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "DeductionStatus" NOT NULL DEFAULT 'PROPOSED',
    "tenantDisputeNote" TEXT,
    "photoIds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgreementPreferences_tenancyId_key" ON "AgreementPreferences"("tenancyId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDocument_userId_type_key" ON "TenantDocument"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DepositRefund_tenancyId_key" ON "DepositRefund"("tenancyId");

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_renewalOfTenancyId_fkey" FOREIGN KEY ("renewalOfTenancyId") REFERENCES "Tenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementPreferences" ADD CONSTRAINT "AgreementPreferences_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositRefund" ADD CONSTRAINT "DepositRefund_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositDeduction" ADD CONSTRAINT "DepositDeduction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "DepositRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
