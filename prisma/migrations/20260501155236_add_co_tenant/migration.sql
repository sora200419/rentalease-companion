-- CreateTable
CREATE TABLE "CoTenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icNumber" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenancyId" TEXT NOT NULL,

    CONSTRAINT "CoTenant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CoTenant" ADD CONSTRAINT "CoTenant_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
