-- Step 1: Create Room table
CREATE TABLE "Room" (
  "id"          TEXT            NOT NULL,
  "label"       TEXT            NOT NULL,
  "bathrooms"   INTEGER         NOT NULL DEFAULT 1,
  "rentAmount"  DECIMAL(10, 2)  NOT NULL,
  "isAvailable" BOOLEAN         NOT NULL DEFAULT true,
  "propertyId"  TEXT            NOT NULL,
  "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 2: Backfill one "Entire Unit" room per existing Property
-- This preserves the old bathrooms and rentAmount values from each property
INSERT INTO "Room" ("id", "label", "bathrooms", "rentAmount", "isAvailable", "propertyId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::TEXT,
  'Entire Unit',
  "bathrooms",
  "rentAmount",
  true,
  "id",
  NOW(),
  NOW()
FROM "Property";

-- Step 3: Add roomId to Tenancy as nullable first (so existing rows don't fail)
ALTER TABLE "Tenancy" ADD COLUMN "roomId" TEXT;

-- Backfill: point each tenancy to the single Room that was just created for its property
UPDATE "Tenancy" t
SET "roomId" = r."id"
FROM "Room" r
WHERE r."propertyId" = t."propertyId";

-- Now that every row has a roomId, enforce NOT NULL
ALTER TABLE "Tenancy" ALTER COLUMN "roomId" SET NOT NULL;

-- Set the new default status for future inserts
ALTER TABLE "Tenancy" ALTER COLUMN "status" SET DEFAULT 'INVITED';

ALTER TABLE "Tenancy"
  ADD CONSTRAINT "Tenancy_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Drop old propertyId from Tenancy (no longer needed — go through room)
ALTER TABLE "Tenancy" DROP CONSTRAINT "Tenancy_propertyId_fkey";
ALTER TABLE "Tenancy" DROP COLUMN "propertyId";

-- Step 5: Drop room-level columns from Property (they've moved to Room)
ALTER TABLE "Property" DROP COLUMN "bedrooms";
ALTER TABLE "Property" DROP COLUMN "bathrooms";
ALTER TABLE "Property" DROP COLUMN "rentAmount";

-- Step 6: Add negotiationRound to Agreement if not already present
ALTER TABLE "Agreement" ADD COLUMN IF NOT EXISTS "negotiationRound" INTEGER NOT NULL DEFAULT 0;

-- Step 7: Migrate any legacy LATE payment records to PENDING
UPDATE "RentPayment" SET "status" = 'PENDING' WHERE "status" = 'LATE';