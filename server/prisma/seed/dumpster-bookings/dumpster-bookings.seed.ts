// prisma/seed/dumpster-bookings/dumpster-bookings.seed.ts

import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import { getIronPeakTenant } from "../tenants/tenants.helpers.js";
import { dumpsterBookingsData } from "./dumpster-bookings.data.js";

const CONCRETE_SURCHARGE_ADDON_CODE = "concreteSurcharge";

function optionalValue<T extends object, K extends string>(object: T, key: K) {
  return key in object ? (object as Record<K, unknown>)[key] : null;
}

function toNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function seedDumpsterBookings(prisma: PrismaClient) {
  console.log("📅 Seeding dumpster bookings...");

  const tenant = await getIronPeakTenant(prisma);

  for (const booking of dumpsterBookingsData) {
    const {
      dumpsterId,
      dumpsterSize,
      totalPrice,
      concreteSurcharge,
      material,
      ...data
    } = booking;

    const concreteSurchargeAmount = toNumber(concreteSurcharge);
    const normalizedAddonsTotal =
      toNumber(data.addonsTotal) + concreteSurchargeAmount;

    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        tenantId: tenant.id,
        id: dumpsterId,
      },
    });

    if (!inventoryItem) {
      throw new Error(
        `Inventory item not found for booking ${booking.bookingNumber}: ${dumpsterId}`,
      );
    }

    const bookingRecord = await prisma.booking.upsert({
      where: {
        tenantId_bookingNumber: {
          tenantId: tenant.id,
          bookingNumber: booking.bookingNumber,
        },
      },

      update: {
        tenant: {
          connect: {
            id: tenant.id,
          },
        },

        serviceType: data.serviceType,
        projectType: optionalValue(data, "projectType") as string | null,

        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,

        clientType: (optionalValue(data, "clientType") as any) ?? "INDIVIDUAL",

        businessName: optionalValue(data, "businessName") as string | null,
        businessPhone: optionalValue(data, "businessPhone") as string | null,
        businessEmail: optionalValue(data, "businessEmail") as string | null,

        address1: data.address1,
        address2: optionalValue(data, "address2") as string | null,
        city: data.city,
        state: data.state,
        zip: data.zip,

        latitude: optionalValue(data, "latitude") as any,
        longitude: optionalValue(data, "longitude") as any,
        distanceFromWarehouse: optionalValue(
          data,
          "distanceFromWarehouse",
        ) as any,

        placement: data.placement,
        instructions: data.instructions,
        customerNotes: data.customerNotes,

        locationVerified: data.locationVerified,
        locationVerificationNote: optionalValue(
          data,
          "locationVerificationNote",
        ) as string | null,

        timezone: tenant.timezone,

        deliveryDate: data.deliveryDate,
        pickupDate: data.pickupDate,

        pickupDateUnknown: data.pickupDateUnknown,
        rentalDaysIncluded: data.rentalDaysIncluded,

        priorityDelivery:
          (optionalValue(data, "priorityDelivery") as boolean | null) ?? false,
        deliveryTime: optionalValue(data, "deliveryTime") as Date | null,
        priorityDeliveryNote: optionalValue(data, "priorityDeliveryNote") as
          | string
          | null,

        bookingStatus: data.bookingStatus,
        paymentStatus: data.paymentStatus,

        stripePaymentIntentId: optionalValue(data, "stripePaymentIntentId") as
          | string
          | null,
        stripePaymentStatus: optionalValue(data, "stripePaymentStatus") as
          | string
          | null,

        paidAt: optionalValue(data, "paidAt") as Date | null,
        confirmedAt: optionalValue(data, "confirmedAt") as Date | null,

        basePrice: data.basePrice,
        deliveryFee: data.deliveryFee,
        mileageFee: data.mileageFee,
        overageFee: data.overageFee,
        extraDaysFee: data.extraDaysFee,
        addonsTotal: normalizedAddonsTotal,

        total: totalPrice,

        quotedAt: optionalValue(data, "quotedAt") as Date | null,
        scheduledAt: optionalValue(data, "scheduledAt") as Date | null,
        deliveredAt: optionalValue(data, "deliveredAt") as Date | null,
        pickedUpAt: optionalValue(data, "pickedUpAt") as Date | null,
        cancelledAt: optionalValue(data, "cancelledAt") as Date | null,
        completedAt: optionalValue(data, "completedAt") as Date | null,
      },

      create: {
        tenant: {
          connect: {
            id: tenant.id,
          },
        },

        bookingNumber: booking.bookingNumber,

        serviceType: data.serviceType,
        projectType: optionalValue(data, "projectType") as string | null,

        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,

        clientType: (optionalValue(data, "clientType") as any) ?? "INDIVIDUAL",

        businessName: optionalValue(data, "businessName") as string | null,
        businessPhone: optionalValue(data, "businessPhone") as string | null,
        businessEmail: optionalValue(data, "businessEmail") as string | null,

        address1: data.address1,
        address2: optionalValue(data, "address2") as string | null,
        city: data.city,
        state: data.state,
        zip: data.zip,

        latitude: optionalValue(data, "latitude") as any,
        longitude: optionalValue(data, "longitude") as any,
        distanceFromWarehouse: optionalValue(
          data,
          "distanceFromWarehouse",
        ) as any,

        placement: data.placement,
        instructions: data.instructions,
        customerNotes: data.customerNotes,

        locationVerified: data.locationVerified,
        locationVerificationNote: optionalValue(
          data,
          "locationVerificationNote",
        ) as string | null,

        timezone: tenant.timezone,

        deliveryDate: data.deliveryDate,
        pickupDate: data.pickupDate,

        pickupDateUnknown: data.pickupDateUnknown,
        rentalDaysIncluded: data.rentalDaysIncluded,

        priorityDelivery:
          (optionalValue(data, "priorityDelivery") as boolean | null) ?? false,
        deliveryTime: optionalValue(data, "deliveryTime") as Date | null,
        priorityDeliveryNote: optionalValue(data, "priorityDeliveryNote") as
          | string
          | null,

        bookingStatus: data.bookingStatus,
        paymentStatus: data.paymentStatus,

        stripePaymentIntentId: optionalValue(data, "stripePaymentIntentId") as
          | string
          | null,
        stripePaymentStatus: optionalValue(data, "stripePaymentStatus") as
          | string
          | null,

        paidAt: optionalValue(data, "paidAt") as Date | null,
        confirmedAt: optionalValue(data, "confirmedAt") as Date | null,

        basePrice: data.basePrice,
        deliveryFee: data.deliveryFee,
        mileageFee: data.mileageFee,
        overageFee: data.overageFee,
        extraDaysFee: data.extraDaysFee,
        addonsTotal: normalizedAddonsTotal,

        total: totalPrice,

        quotedAt: optionalValue(data, "quotedAt") as Date | null,
        scheduledAt: optionalValue(data, "scheduledAt") as Date | null,
        deliveredAt: optionalValue(data, "deliveredAt") as Date | null,
        pickedUpAt: optionalValue(data, "pickedUpAt") as Date | null,
        cancelledAt: optionalValue(data, "cancelledAt") as Date | null,
        completedAt: optionalValue(data, "completedAt") as Date | null,
      },
    });

    await upsertBookingInventoryItem({
      prisma,
      tenantId: tenant.id,
      bookingId: bookingRecord.id,
      inventoryItem,
    });

    await upsertConcreteSurchargeAddon({
      prisma,
      tenantId: tenant.id,
      bookingId: bookingRecord.id,
      concreteSurcharge: concreteSurchargeAmount,
    });
  }

  console.log(`   ✓ ${dumpsterBookingsData.length} bookings seeded`);
}

async function upsertBookingInventoryItem({
  prisma,
  tenantId,
  bookingId,
  inventoryItem,
}: {
  prisma: PrismaClient;
  tenantId: string;
  bookingId: string;
  inventoryItem: NonNullable<
    Awaited<ReturnType<PrismaClient["inventoryItem"]["findFirst"]>>
  >;
}) {
  const existingBookingItem = await prisma.bookingInventoryItem.findFirst({
    where: {
      tenantId,
      bookingId,
      inventoryItemId: inventoryItem.id,
      role: "PRIMARY",
    },
  });

  const data = {
    tenantId,

    role: "PRIMARY",

    itemCategorySnapshot: inventoryItem.category,
    itemLabelSnapshot: inventoryItem.label,
    itemSizeValueSnapshot: inventoryItem.sizeValue,
    itemSizeUnitSnapshot: inventoryItem.sizeUnit,
    itemSerialSnapshot: inventoryItem.serialNumber,

    basePriceSnapshot: inventoryItem.basePrice,
    concretePriceSnapshot: inventoryItem.concretePrice,
  };

  if (existingBookingItem) {
    await prisma.bookingInventoryItem.update({
      where: {
        id: existingBookingItem.id,
      },
      data,
    });

    return;
  }

  await prisma.bookingInventoryItem.create({
    data: {
      ...data,
      booking: {
        connect: {
          id: bookingId,
        },
      },
      inventoryItem: {
        connect: {
          id: inventoryItem.id,
        },
      },
    },
  });
}

async function upsertConcreteSurchargeAddon({
  prisma,
  tenantId,
  bookingId,
  concreteSurcharge,
}: {
  prisma: PrismaClient;
  tenantId: string;
  bookingId: string;
  concreteSurcharge: number;
}) {
  if (concreteSurcharge <= 0) {
    await prisma.bookingAddon.deleteMany({
      where: {
        tenantId,
        bookingId,
        addonCodeSnapshot: CONCRETE_SURCHARGE_ADDON_CODE,
      },
    });

    return;
  }

  const addon = await prisma.addon.findUnique({
    where: {
      tenantId_code: {
        tenantId,
        code: CONCRETE_SURCHARGE_ADDON_CODE,
      },
    },
  });

  if (!addon) {
    throw new Error(
      `Addon "${CONCRETE_SURCHARGE_ADDON_CODE}" was not found. Seed addons before bookings.`,
    );
  }

  const existingBookingAddon = await prisma.bookingAddon.findFirst({
    where: {
      tenantId,
      bookingId,
      addonId: addon.id,
    },
  });

  const data = {
    tenantId,

    addonCodeSnapshot: addon.code,
    addonNameSnapshot: addon.name,
    addonPriceSnapshot: concreteSurcharge,

    quantity: 1,
  };

  if (existingBookingAddon) {
    await prisma.bookingAddon.update({
      where: {
        id: existingBookingAddon.id,
      },
      data,
    });

    return;
  }

  await prisma.bookingAddon.create({
    data: {
      ...data,
      booking: {
        connect: {
          id: bookingId,
        },
      },
      addon: {
        connect: {
          id: addon.id,
        },
      },
    },
  });
}
