-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AlterTable OtpChallenge: rename email → identifier
ALTER TABLE "OtpChallenge" RENAME COLUMN "email" TO "identifier";

-- DropIndex
DROP INDEX IF EXISTS "OtpChallenge_email_createdAt_idx";

-- CreateIndex
CREATE INDEX "OtpChallenge_identifier_createdAt_idx" ON "OtpChallenge"("identifier", "createdAt");
