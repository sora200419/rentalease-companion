-- CreateEnum
CREATE TYPE "AgreementEventType" AS ENUM ('GENERATED', 'EDITED', 'FINALIZED', 'REQUESTED_CHANGES', 'SIGNED');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateTable
CREATE TABLE "AgreementEvent" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "type" "AgreementEventType" NOT NULL,
    "actorRole" "Role" NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementRevision" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "rawContent" TEXT NOT NULL,
    "plainLanguageSummary" TEXT NOT NULL,
    "plainLanguageSummaryMs" TEXT,
    "redFlags" TEXT,
    "redFlagsMs" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementChangeRequest" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requestedChange" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreementChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgreementEvent_agreementId_createdAt_idx" ON "AgreementEvent"("agreementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementRevision_agreementId_versionNumber_key" ON "AgreementRevision"("agreementId", "versionNumber");

-- CreateIndex
CREATE INDEX "AgreementChangeRequest_agreementId_status_idx" ON "AgreementChangeRequest"("agreementId", "status");

-- AddForeignKey
ALTER TABLE "AgreementEvent" ADD CONSTRAINT "AgreementEvent_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementRevision" ADD CONSTRAINT "AgreementRevision_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementChangeRequest" ADD CONSTRAINT "AgreementChangeRequest_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
