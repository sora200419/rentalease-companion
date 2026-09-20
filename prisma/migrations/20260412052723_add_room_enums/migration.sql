-- Phase 11: Room Detail Fields
-- Step 1: Create new enum types for room categorisation.
-- These must appear before any ALTER TABLE that references them.
CREATE TYPE "RoomType"        AS ENUM ('MASTER', 'MEDIUM', 'SMALL', 'STUDIO', 'ENTIRE_UNIT');
CREATE TYPE "BathroomType"    AS ENUM ('ATTACHED', 'SHARED');
CREATE TYPE "FurnishingLevel" AS ENUM ('FULLY_FURNISHED', 'PARTIALLY_FURNISHED', 'UNFURNISHED');
CREATE TYPE "GenderPref"      AS ENUM ('ANY', 'MALE_ONLY', 'FEMALE_ONLY');

-- Step 2: Add all new columns to the Room table with safe defaults.
-- The 3 existing rows (backfilled "Entire Unit" rooms from Phase 10)
-- will receive these defaults — the landlord can edit them from the dashboard.
ALTER TABLE "Room"
  ADD COLUMN "roomType"          "RoomType"        NOT NULL DEFAULT 'ENTIRE_UNIT',
  ADD COLUMN "bathroomType"      "BathroomType"    NOT NULL DEFAULT 'ATTACHED',
  ADD COLUMN "furnishing"        "FurnishingLevel" NOT NULL DEFAULT 'PARTIALLY_FURNISHED',
  ADD COLUMN "maxOccupants"      INTEGER           NOT NULL DEFAULT 1,
  ADD COLUMN "sizeSqFt"          INTEGER,
  ADD COLUMN "floorLevel"        INTEGER,
  ADD COLUMN "wifiIncluded"      BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN "waterIncluded"     BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN "electricIncluded"  BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN "genderPreference"  "GenderPref"      NOT NULL DEFAULT 'ANY',
  ADD COLUMN "notes"             TEXT;