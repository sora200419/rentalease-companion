-- CreateEnum
CREATE TYPE "LeasePartyType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "AgreementSignatureProofStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgreementEventType" ADD VALUE 'DIGITAL_SIGNED';
ALTER TYPE "AgreementEventType" ADD VALUE 'SIGNATURE_PROOF_UPLOADED';
ALTER TYPE "AgreementEventType" ADD VALUE 'SIGNATURE_PROOF_REJECTED';
ALTER TYPE "AgreementEventType" ADD VALUE 'SIGNATURE_PROOF_APPROVED';

-- AlterEnum
ALTER TYPE "AgreementStatus" ADD VALUE 'PENDING_SIGNATURE_PROOF';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_SIGNATURE_PROOF_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_SIGNATURE_PROOF_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_SIGNATURE_PROOF_REJECTED';

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN     "authorizedSignatoryIC" TEXT,
ADD COLUMN     "authorizedSignatoryName" TEXT,
ADD COLUMN     "authorizedSignatoryRole" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "companyRegistrationNo" TEXT,
ADD COLUMN     "leasePartyType" "LeasePartyType" NOT NULL DEFAULT 'INDIVIDUAL';

-- CreateTable
CREATE TABLE "AgreementSignatureProof" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "AgreementSignatureProofStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementSignatureProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementSignatureProof_agreementId_createdAt_idx" ON "AgreementSignatureProof"("agreementId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementSignatureProof_agreementId_status_idx" ON "AgreementSignatureProof"("agreementId", "status");

-- AddForeignKey
ALTER TABLE "AgreementSignatureProof" ADD CONSTRAINT "AgreementSignatureProof_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSignatureProof" ADD CONSTRAINT "AgreementSignatureProof_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSignatureProof" ADD CONSTRAINT "AgreementSignatureProof_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
