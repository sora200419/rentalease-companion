-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "signedAcknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedByIp" TEXT;
