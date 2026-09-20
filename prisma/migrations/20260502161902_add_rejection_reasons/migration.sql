-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_KYC_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PROPERTY_VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PROPERTY_VERIFICATION_REJECTED';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "rejectedReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kycRejectedReason" TEXT;
