-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ConditionReport_tenancyId_status_idx" ON "ConditionReport"("tenancyId", "status");

-- CreateIndex
CREATE INDEX "ConditionReport_createdById_idx" ON "ConditionReport"("createdById");

-- CreateIndex
CREATE INDEX "DepositProof_tenancyId_createdAt_idx" ON "DepositProof"("tenancyId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositProof_uploadedById_idx" ON "DepositProof"("uploadedById");

-- CreateIndex
CREATE INDEX "Message_tenancyId_createdAt_idx" ON "Message"("tenancyId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_receiverId_read_idx" ON "Message"("receiverId", "read");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PaymentProof_paymentId_createdAt_idx" ON "PaymentProof"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentProof_uploadedById_idx" ON "PaymentProof"("uploadedById");

-- CreateIndex
CREATE INDEX "Property_landlordId_idx" ON "Property"("landlordId");

-- CreateIndex
CREATE INDEX "Property_isVerified_createdAt_idx" ON "Property"("isVerified", "createdAt");

-- CreateIndex
CREATE INDEX "RentPayment_tenancyId_dueDate_idx" ON "RentPayment"("tenancyId", "dueDate");

-- CreateIndex
CREATE INDEX "RentPayment_status_idx" ON "RentPayment"("status");

-- CreateIndex
CREATE INDEX "Tenancy_tenantId_idx" ON "Tenancy"("tenantId");

-- CreateIndex
CREATE INDEX "Tenancy_roomId_idx" ON "Tenancy"("roomId");

-- CreateIndex
CREATE INDEX "Tenancy_status_idx" ON "Tenancy"("status");
