-- CreateEnum
CREATE TYPE "BookingNoteType" AS ENUM ('NOTE', 'CHANGE_REQUEST', 'RESCHEDULE_REQUEST');

-- CreateEnum
CREATE TYPE "BookingNoteRequestStatus" AS ENUM ('OPEN', 'APPROVED', 'DECLINED', 'RESOLVED');

-- AlterTable
ALTER TABLE "BookingNote" ADD COLUMN     "authorLabel" TEXT,
ADD COLUMN     "authorType" "BookingActorType" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "authorUserId" TEXT,
ADD COLUMN     "requestStatus" "BookingNoteRequestStatus",
ADD COLUMN     "requestedDeliveryDate" DATE,
ADD COLUMN     "requestedPickupDate" DATE,
ADD COLUMN     "requestedPickupDateUnknown" BOOLEAN,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByUserId" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" "BookingNoteType" NOT NULL DEFAULT 'NOTE';

-- CreateTable
CREATE TABLE "BookingNoteView" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingNoteView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingNoteView_tenantId_idx" ON "BookingNoteView"("tenantId");

-- CreateIndex
CREATE INDEX "BookingNoteView_userId_idx" ON "BookingNoteView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingNoteView_noteId_userId_key" ON "BookingNoteView"("noteId", "userId");

-- CreateIndex
CREATE INDEX "BookingNote_tenantId_requestStatus_idx" ON "BookingNote"("tenantId", "requestStatus");

-- CreateIndex
CREATE INDEX "BookingNote_authorUserId_idx" ON "BookingNote"("authorUserId");

-- AddForeignKey
ALTER TABLE "BookingNote" ADD CONSTRAINT "BookingNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingNote" ADD CONSTRAINT "BookingNote_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingNoteView" ADD CONSTRAINT "BookingNoteView_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "BookingNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingNoteView" ADD CONSTRAINT "BookingNoteView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing customer-visible notes were written by customers
-- (the client portal and checkout), and old change requests were stored as
-- notes starting with "Change request:".
UPDATE "BookingNote" SET "authorType" = 'CLIENT' WHERE "visibility" = 'CUSTOMER';

UPDATE "BookingNote"
SET "type" = 'CHANGE_REQUEST',
    "requestStatus" = 'OPEN',
    "title" = split_part("body", E'\n', 1)
WHERE "body" LIKE 'Change request:%';
