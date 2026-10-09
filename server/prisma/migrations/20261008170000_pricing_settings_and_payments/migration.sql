-- Server-side pricing rules per tenant, booking price breakdown, fulfillment
-- type, booking source, payments ledger, add-on pricing types.

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'CUSTOMER_PICKUP');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEB', 'ADMIN', 'PHONE');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AddonPriceType" AS ENUM ('FLAT', 'PER_DAY');

-- AlterTable
ALTER TABLE "Addon" ADD COLUMN     "category" "InventoryCategory",
ADD COLUMN     "priceType" "AddonPriceType" NOT NULL DEFAULT 'FLAT';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "billableMiles" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "extraDayRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "extraDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "material" TEXT,
ADD COLUMN     "materialFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "perMileRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "priorityDeliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(6,5) NOT NULL DEFAULT 0,
ALTER COLUMN "address1" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "state" DROP NOT NULL,
ALTER COLUMN "zip" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingAddon" ADD COLUMN     "addonPriceTypeSnapshot" "AddonPriceType" NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "lineTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "extraDayRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rentalDaysIncluded" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allowDelivery" BOOLEAN NOT NULL DEFAULT true,
    "allowCustomerPickup" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "freeDeliveryMiles" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "perMileRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxDeliveryMiles" DECIMAL(10,2),
    "priorityDeliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minNoticeDays" INTEGER NOT NULL DEFAULT 1,
    "maxRentalDays" INTEGER NOT NULL DEFAULT 30,
    "taxRate" DECIMAL(6,5) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'CHARGE',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeRefundId" TEXT,
    "failureMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeRefundId_key" ON "Payment"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_bookingId_idx" ON "Payment"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_type_key" ON "Payment"("stripePaymentIntentId", "type");

-- CreateIndex
CREATE INDEX "Booking_createdByUserId_idx" ON "Booking"("createdByUserId");

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing totals had no tax or discount.
UPDATE "Booking" SET "subtotal" = "total";

-- Backfill: add-on line totals (all existing add-ons were flat).
UPDATE "BookingAddon" SET "lineTotal" = "addonPriceSnapshot" * "quantity";

-- Backfill: one settings row per tenant (all-zero pricing until configured).
INSERT INTO "TenantSettings" ("id", "tenantId", "updatedAt")
SELECT 'settings_' || "id", "id", CURRENT_TIMESTAMP FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

-- Backfill: a payment row for bookings already paid through Stripe.
INSERT INTO "Payment" ("id", "tenantId", "bookingId", "type", "status", "amount", "stripePaymentIntentId", "paidAt", "updatedAt")
SELECT 'payment_' || "id", "tenantId", "id", 'CHARGE', 'SUCCEEDED', "total", "stripePaymentIntentId", COALESCE("paidAt", "updatedAt"), CURRENT_TIMESTAMP
FROM "Booking"
WHERE "paymentStatus" = 'PAID' AND "stripePaymentIntentId" IS NOT NULL
ON CONFLICT DO NOTHING;
