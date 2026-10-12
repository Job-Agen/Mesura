-- CreateEnum
CREATE TYPE "FingerprintKind" AS ENUM ('IDENTITY', 'PHONE');

-- AlterTable
ALTER TABLE "Funding" ADD COLUMN     "freeCard" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Fingerprint" (
    "hash" TEXT NOT NULL,
    "kind" "FingerprintKind" NOT NULL,
    "userId" TEXT,
    "freeCardsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fingerprint_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "Fingerprint_userId_idx" ON "Fingerprint"("userId");

-- AddForeignKey
ALTER TABLE "Fingerprint" ADD CONSTRAINT "Fingerprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

