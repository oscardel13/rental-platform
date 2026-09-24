// prisma/seed/dumpster-bookings/dumpster-bookings.seed.ts

import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  ClientType,
  NoteVisibility,
} from "../../../src/generated/prisma/client.js";

import { getIronPeakTenant } from "../tenants/tenants.helpers.js";
import { dumpsterBookingsData } from "./dumpster-bookings.data.js";

const EXTRA_DAY_RATE = 25;

function toNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function addDays(days: number) {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function addDaysToDate(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getLifecycleDates({
  deliveryDate,
  pickupDate,
  bookingStatus,
  paymentStatus,
}: {
  deliveryDate: Date;
  pickupDate: Date | null;
  bookingStatus: string;
  paymentStatus: string;
}) {
  const now = new Date();
  const isPaid = paymentStatus === "PAID";

  return {
    quotedAt: addDaysToDate(deliveryDate, -4),
    scheduledAt: ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(bookingStatus)
      ? addDaysToDate(deliveryDate, -3)
      : null,
    confirmedAt: isPaid ? addDaysToDate(deliveryDate, -3) : null,
    paidAt: isPaid ? addDaysToDate(deliveryDate, -3) : null,
    deliveredAt: ["ACTIVE", "COMPLETED"].includes(bookingStatus)
      ? deliveryDate
      : null,
    pickedUpAt: bookingStatus === "COMPLETED" ? pickupDate : null,
    completedAt: bookingStatus === "COMPLETED" ? (pickupDate ?? now) : null,
    cancelledAt: bookingStatus === "CANCELLED" ? now : null,
  };
}

export async function seedDumpsterBookings(prisma: PrismaClient) {
  console.log("📅 Seeding dumpster bookings...");

  const tenant = await getIronPeakTenant(prisma);

  for (const booking of dumpsterBookingsData) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: {
        tenantId: tenant.id,
        id: booking.inventoryItemId,
      },
    });

    if (!inventoryItem) {
      throw new Error(
        `Inventory item not found for booking ${booking.bookingNumber}: ${booking.inventoryItemId}`,
      );
    }

    const deliveryDate = addDays(booking.deliveryOffsetDays);
    const pickupDate = booking.pickupDateUnknown
      ? null
      : addDaysToDate(deliveryDate, booking.rentalDays);

    const rentalDaysIncluded = booking.rentalDaysIncluded ?? 7;
    const extraDays = Math.max(booking.rentalDays - rentalDaysIncluded, 0);

    const basePrice = toNumber(inventoryItem.basePrice);
    const deliveryFee = toNumber(booking.deliveryFee);
    const mileageFee = toNumber(booking.mileageFee);
    const overageFee = toNumber(booking.overageFee);
    const extraDaysFee =
      booking.extraDaysFee !== undefined
        ? toNumber(booking.extraDaysFee)
        : extraDays * EXTRA_DAY_RATE;

    const selectedAddons = await getSelectedAddons({
      prisma,
      tenantId: tenant.id,
      addonCodes: booking.addonCodes ?? [],
    });

    const addonsTotal = selectedAddons.reduce((sum, addon) => {
      return sum + toNumber(addon.price);
    }, 0);

    const total =
      basePrice +
      deliveryFee +
      mileageFee +
      overageFee +
      extraDaysFee +
      addonsTotal;

    const lifecycleDates = getLifecycleDates({
      deliveryDate,
      pickupDate,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
    });

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

        serviceType: booking.serviceType,
        projectType: booking.projectType ?? null,

        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,

        clientType: booking.clientType ?? ClientType.INDIVIDUAL,

        businessName: booking.businessName ?? null,
        businessPhone: booking.businessPhone ?? null,
        businessEmail: booking.businessEmail ?? null,

        address1: booking.address1,
        address2: booking.address2 ?? null,
        city: booking.city,
        state: booking.state,
        zip: booking.zip,

        latitude: booking.latitude ?? null,
        longitude: booking.longitude ?? null,
        distanceFromWarehouse: booking.distanceFromWarehouse ?? null,

        placement: booking.placement,
        instructions: booking.instructions,
        customerNotes: booking.customerNotes,

        locationVerified: booking.locationVerified,
        locationVerificationNote: booking.locationVerificationNote ?? null,

        timezone: tenant.timezone,

        deliveryDate,
        pickupDate,

        pickupDateUnknown: booking.pickupDateUnknown ?? false,
        rentalDaysIncluded,

        priorityDelivery: booking.priorityDelivery ?? false,
        deliveryTime: booking.priorityDelivery ? deliveryDate : null,
        priorityDeliveryNote: booking.priorityDeliveryNote ?? null,

        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,

        stripePaymentIntentId: booking.stripePaymentIntentId ?? null,
        stripePaymentStatus: booking.stripePaymentStatus ?? null,

        basePrice,
        deliveryFee,
        mileageFee,
        overageFee,
        extraDaysFee,
        addonsTotal,
        total,

        ...lifecycleDates,
      },

      create: {
        tenant: {
          connect: {
            id: tenant.id,
          },
        },

        bookingNumber: booking.bookingNumber,

        serviceType: booking.serviceType,
        projectType: booking.projectType ?? null,

        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,

        clientType: booking.clientType ?? ClientType.INDIVIDUAL,

        businessName: booking.businessName ?? null,
        businessPhone: booking.businessPhone ?? null,
        businessEmail: booking.businessEmail ?? null,

        address1: booking.address1,
        address2: booking.address2 ?? null,
        city: booking.city,
        state: booking.state,
        zip: booking.zip,

        latitude: booking.latitude ?? null,
        longitude: booking.longitude ?? null,
        distanceFromWarehouse: booking.distanceFromWarehouse ?? null,

        placement: booking.placement,
        instructions: booking.instructions,
        customerNotes: booking.customerNotes,

        locationVerified: booking.locationVerified,
        locationVerificationNote: booking.locationVerificationNote ?? null,

        timezone: tenant.timezone,

        deliveryDate,
        pickupDate,

        pickupDateUnknown: booking.pickupDateUnknown ?? false,
        rentalDaysIncluded,

        priorityDelivery: booking.priorityDelivery ?? false,
        deliveryTime: booking.priorityDelivery ? deliveryDate : null,
        priorityDeliveryNote: booking.priorityDeliveryNote ?? null,

        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,

        stripePaymentIntentId: booking.stripePaymentIntentId ?? null,
        stripePaymentStatus: booking.stripePaymentStatus ?? null,

        basePrice,
        deliveryFee,
        mileageFee,
        overageFee,
        extraDaysFee,
        addonsTotal,
        total,

        ...lifecycleDates,
      },
    });

    await upsertBookingInventoryItem({
      prisma,
      tenantId: tenant.id,
      bookingId: bookingRecord.id,
      inventoryItem,
    });

    await syncBookingAddons({
      prisma,
      tenantId: tenant.id,
      bookingId: bookingRecord.id,
      addons: selectedAddons,
    });

    await upsertBookingSeedNote({
      prisma,
      tenantId: tenant.id,
      bookingId: bookingRecord.id,
      summary: `Seeded ${booking.projectType ?? booking.material} booking for ${
        booking.customerName
      }.`,
    });
  }

  console.log(`   ✓ ${dumpsterBookingsData.length} bookings seeded`);
}

async function getSelectedAddons({
  prisma,
  tenantId,
  addonCodes,
}: {
  prisma: PrismaClient;
  tenantId: string;
  addonCodes: string[];
}) {
  if (addonCodes.length === 0) return [];

  const addons = await prisma.addon.findMany({
    where: {
      tenantId,
      code: {
        in: addonCodes,
      },
    },
  });

  const foundCodes = new Set(addons.map((addon) => addon.code));

  for (const addonCode of addonCodes) {
    if (!foundCodes.has(addonCode)) {
      throw new Error(
        `Addon "${addonCode}" was not found. Seed addons before bookings.`,
      );
    }
  }

  return addons;
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

async function syncBookingAddons({
  prisma,
  tenantId,
  bookingId,
  addons,
}: {
  prisma: PrismaClient;
  tenantId: string;
  bookingId: string;
  addons: Awaited<ReturnType<typeof getSelectedAddons>>;
}) {
  const addonIds = addons.map((addon) => addon.id);

  await prisma.bookingAddon.deleteMany({
    where: {
      tenantId,
      bookingId,
      ...(addonIds.length
        ? {
            addonId: {
              notIn: addonIds,
            },
          }
        : {}),
    },
  });

  for (const addon of addons) {
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
      addonPriceSnapshot: addon.price,

      quantity: 1,
    };

    if (existingBookingAddon) {
      await prisma.bookingAddon.update({
        where: {
          id: existingBookingAddon.id,
        },
        data,
      });

      continue;
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
}

async function upsertBookingSeedNote({
  prisma,
  tenantId,
  bookingId,
  summary,
}: {
  prisma: PrismaClient;
  tenantId: string;
  bookingId: string;
  summary: string;
}) {
  const existingNote = await prisma.bookingNote.findFirst({
    where: {
      tenantId,
      bookingId,
      body: summary,
    },
  });

  if (existingNote) return;

  await prisma.bookingNote.create({
    data: {
      tenantId,
      bookingId,
      visibility: NoteVisibility.INTERNAL,
      body: summary,
    },
  });
}
