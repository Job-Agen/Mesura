-- AlterTable
ALTER TABLE "User" ADD COLUMN "issuerCardholderId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "providerReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_issuerCardholderId_key" ON "User"("issuerCardholderId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_providerReference_key" ON "Transaction"("providerReference");
