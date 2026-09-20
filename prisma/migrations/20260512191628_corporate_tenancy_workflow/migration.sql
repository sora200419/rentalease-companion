-- CreateEnum
CREATE TYPE "CorporateOccupantStatus" AS ENUM ('UNLINKED', 'LINKED', 'REPLACED', 'REMOVED');

-- AlterTable
ALTER TABLE "Tenancy" ADD COLUMN     "authorizedSignatoryUserId" TEXT;

-- CreateTable
CREATE TABLE "CorporateOccupant" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icNumber" TEXT,
    "phone" TEXT,
    "roleLabel" TEXT,
    "linkedUserId" TEXT,
    "status" "CorporateOccupantStatus" NOT NULL DEFAULT 'UNLINKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateOccupant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorporateOccupant_tenancyId_status_idx" ON "CorporateOccupant"("tenancyId", "status");

-- CreateIndex
CREATE INDEX "CorporateOccupant_linkedUserId_idx" ON "CorporateOccupant"("linkedUserId");

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_authorizedSignatoryUserId_fkey" FOREIGN KEY ("authorizedSignatoryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateOccupant" ADD CONSTRAINT "CorporateOccupant_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateOccupant" ADD CONSTRAINT "CorporateOccupant_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
