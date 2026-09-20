-- AlterEnum
ALTER TYPE "AgreementStatus" ADD VALUE 'NEGOTIATING';

-- AlterTable
ALTER TABLE "Agreement" ADD COLUMN     "negotiationNotes" TEXT;
