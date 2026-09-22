import {
  BookingActorType,
  BookingStatus,
  ClientType,
  NoteVisibility,
  PaymentStatus,
  Prisma,
  ServiceType,
} from "../../generated/prisma/client.js";
import { prisma } from "../../libs/prisma.js";

import { createServiceError } from "../../utils/error.utils.ts";

import {
  checkInventoryAvailability,
  findInventoryItemOrThrow,
} from "./booking-availability.service.ts";
import {
  createBookingAddonRows,
  getSelectedAddons,
} from "./booking-addons.service.ts";
import { createOrUpdateClient } from "./booking-client.service.ts";
import { getCheckoutDraftResponse } from "./booking-checkout-payment.service.ts";
import { generateBookingNumber } from "./booking-number.service.ts";
import {
  bookingInclude,
  getPrimaryInventoryItem,
  normalizeBookingResponse,
  normalizeInventoryItemForBookingResponse,
} from "./booking-normalizer.service.ts";
import { calculatePricing } from "./booking-pricing.service.ts";
import {
  normalizeEmail,
  validatePublicBookingData,
} from "./booking-validation.service.ts";

type CreatePublicBookingQuoteInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

type CreatePublicBookingInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

type CreatePublicBookingCheckoutDraftInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

type UpdatePublicBookingCheckoutDraftInput = {
  tenantId: string;
  tenantTimezone: string;
  bookingId: string;
  data: any;
};

type GetPublicBookingStatusInput = {
  tenantId: string;
  bookingNumber: string;
  email: string;
};

function normalizeMoney(value: unknown) {
  return Number(value || 0);
}

export async function createPublicBookingQuote({
  tenantId,
  data,
}: CreatePublicBookingQuoteInput) {
  const validated = validatePublicBookingData(data);

  const inventoryItem = await findInventoryItemOrThrow({
    tenantId,
    inventoryItemId: validated.inventoryItemId,
  });

  await checkInventoryAvailability({
    tenantId,
    inventoryItemId: inventoryItem.id,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
    pickupDateUnknown: validated.pickupDateUnknown,
  });

  const selectedAddons = await getSelectedAddons({
    tenantId,
    data,
  });

  const pricing = calculatePricing({
    inventoryItem,
    selectedAddons,
    data,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
  });

  return {
    available: true,
    inventoryItem: {
      id: inventoryItem.id,
      label: inventoryItem.label,
      category: inventoryItem.category,
      sizeValue: inventoryItem.sizeValue
        ? Number(inventoryItem.sizeValue)
        : null,
      sizeUnit: inventoryItem.sizeUnit,
      basePrice: normalizeMoney(inventoryItem.basePrice),
      concretePrice: normalizeMoney(inventoryItem.concretePrice),

      // Temporary old frontend aliases.
      dumpsterId: inventoryItem.id,
      dumpsterLabel: inventoryItem.label,
      dumpsterSize: inventoryItem.sizeValue
        ? Number(inventoryItem.sizeValue)
        : null,
    },
    addons: selectedAddons.map((selectedAddon) => ({
      id: selectedAddon.addon.id,
      code: selectedAddon.addon.code,
      name: selectedAddon.addon.name,
      description: selectedAddon.addon.description,
      price: normalizeMoney(selectedAddon.addon.price),
      quantity: selectedAddon.quantity,
      total: normalizeMoney(selectedAddon.addon.price) * selectedAddon.quantity,
    })),
    pricing,
  };
}

export async function createPublicBooking({
  tenantId,
  tenantTimezone,
  data,
}: CreatePublicBookingInput) {
  const validated = validatePublicBookingData(data);

  const inventoryItem = await findInventoryItemOrThrow({
    tenantId,
    inventoryItemId: validated.inventoryItemId,
  });

  await checkInventoryAvailability({
    tenantId,
    inventoryItemId: inventoryItem.id,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
    pickupDateUnknown: validated.pickupDateUnknown,
  });

  const selectedAddons = await getSelectedAddons({
    tenantId,
    data,
  });

  const pricing = calculatePricing({
    inventoryItem,
    selectedAddons,
    data,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
  });

  const bookingNumber = await generateBookingNumber(tenantId);
  const clientType = data.clientType ?? ClientType.INDIVIDUAL;

  const booking = await prisma.$transaction(async (tx) => {
    const client = await createOrUpdateClient({
      tx,
      tenantId,
      clientType,
      validated,
      data,
    });

    const createdBooking = await tx.booking.create({
      data: {
        tenant: {
          connect: {
            id: tenantId,
          },
        },
        client: {
          connect: {
            id: client.id,
          },
        },

        bookingNumber,

        serviceType: data.serviceType ?? ServiceType.DUMPSTER_RENTAL,
        projectType: data.projectType ?? null,

        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail,

        clientType,
        businessName: data.businessName ?? null,
        businessEmail: data.businessEmail ?? null,
        businessPhone: data.businessPhone ?? null,

        address1: validated.address1,
        address2: data.address2 ?? null,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,

        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        distanceFromWarehouse: data.distanceFromWarehouse ?? null,

        placement: data.placement ?? null,
        instructions: data.instructions ?? null,
        customerNotes: data.customerNotes ?? data.notes ?? null,

        locationVerified: Boolean(data.locationVerified),
        locationVerificationNote: data.locationVerificationNote ?? null,

        timezone: tenantTimezone,

        deliveryDate: validated.deliveryDate,
        pickupDate: validated.pickupDate,
        pickupDateUnknown: validated.pickupDateUnknown,
        rentalDaysIncluded: pricing.rentalDaysIncluded,

        priorityDelivery: Boolean(data.priorityDelivery),
        deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        priorityDeliveryNote: data.priorityDeliveryNote ?? null,

        bookingStatus: data.bookingStatus ?? BookingStatus.QUOTE,
        paymentStatus: data.paymentStatus ?? PaymentStatus.UNPAID,

        stripePaymentIntentId: data.stripePaymentIntentId ?? null,
        stripePaymentStatus: data.stripePaymentStatus ?? null,

        basePrice: new Prisma.Decimal(pricing.basePrice),
        deliveryFee: new Prisma.Decimal(pricing.deliveryFee),
        mileageFee: new Prisma.Decimal(pricing.mileageFee),
        extraDaysFee: new Prisma.Decimal(pricing.extraDaysFee),
        overageFee: new Prisma.Decimal(pricing.overageFee),
        addonsTotal: new Prisma.Decimal(pricing.addonsTotal),
        total: new Prisma.Decimal(pricing.total),

        quotedAt: new Date(),
      },
    });

    await tx.bookingInventoryItem.create({
      data: {
        tenantId,
        bookingId: createdBooking.id,
        inventoryItemId: inventoryItem.id,
        role: "PRIMARY",

        itemCategorySnapshot: inventoryItem.category,
        itemLabelSnapshot: inventoryItem.label,
        itemSizeValueSnapshot: inventoryItem.sizeValue,
        itemSizeUnitSnapshot: inventoryItem.sizeUnit,
        itemSerialSnapshot: inventoryItem.serialNumber,

        basePriceSnapshot: inventoryItem.basePrice,
        concretePriceSnapshot: inventoryItem.concretePrice,
      },
    });

    await createBookingAddonRows({
      tx,
      tenantId,
      bookingId: createdBooking.id,
      selectedAddons,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId: createdBooking.id,
        eventType: "PUBLIC_BOOKING_CREATED",
        actorType: BookingActorType.CLIENT,
        actorLabel: validated.customerName,
        summary: "Public booking was created.",
        metadata: {
          customerEmail: validated.customerEmail,
          inventoryItemId: inventoryItem.id,
          total: pricing.total,
        },
      },
    });

    if (data.customerNotes || data.notes) {
      await tx.bookingNote.create({
        data: {
          tenantId,
          bookingId: createdBooking.id,
          visibility: NoteVisibility.CUSTOMER,
          body: String(data.customerNotes || data.notes),
        },
      });
    }

    return tx.booking.findUnique({
      where: {
        id: createdBooking.id,
      },
      include: bookingInclude,
    });
  });

  if (!booking) {
    throw createServiceError("Failed to create booking.", 500);
  }

  return normalizeBookingResponse(booking);
}

export async function createPublicBookingCheckoutDraft({
  tenantId,
  tenantTimezone,
  data,
}: CreatePublicBookingCheckoutDraftInput) {
  const booking = await createPublicBooking({
    tenantId,
    tenantTimezone,
    data: {
      ...data,
      bookingStatus: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  const fullBooking = await prisma.booking.findFirst({
    where: {
      id: booking.id,
      tenantId,
    },
    include: bookingInclude,
  });

  if (!fullBooking) {
    throw createServiceError("Failed to create checkout draft.", 500);
  }

  return getCheckoutDraftResponse(fullBooking);
}

export async function updatePublicBookingCheckoutDraft({
  tenantId,
  tenantTimezone,
  bookingId,
  data,
}: UpdatePublicBookingCheckoutDraftInput) {
  const validated = validatePublicBookingData(data);

  const existingBooking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      tenantId,
      customerEmail: validated.customerEmail,
      bookingStatus: {
        in: [BookingStatus.QUOTE, BookingStatus.PENDING_PAYMENT],
      },
    },
  });

  if (!existingBooking) {
    throw createServiceError("Checkout draft not found.", 404);
  }

  const inventoryItem = await findInventoryItemOrThrow({
    tenantId,
    inventoryItemId: validated.inventoryItemId,
  });

  await checkInventoryAvailability({
    tenantId,
    inventoryItemId: inventoryItem.id,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
    pickupDateUnknown: validated.pickupDateUnknown,
    ignoreBookingId: existingBooking.id,
  });

  const selectedAddons = await getSelectedAddons({
    tenantId,
    data,
  });

  const pricing = calculatePricing({
    inventoryItem,
    selectedAddons,
    data,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
  });

  const clientType = data.clientType ?? ClientType.INDIVIDUAL;

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const client = await createOrUpdateClient({
      tx,
      tenantId,
      clientType,
      validated,
      data,
    });

    await tx.booking.update({
      where: {
        id: existingBooking.id,
      },
      data: {
        client: {
          connect: {
            id: client.id,
          },
        },

        serviceType: data.serviceType ?? ServiceType.DUMPSTER_RENTAL,
        projectType: data.projectType ?? null,

        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail,

        clientType,
        businessName: data.businessName ?? null,
        businessEmail: data.businessEmail ?? null,
        businessPhone: data.businessPhone ?? null,

        address1: validated.address1,
        address2: data.address2 ?? null,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,

        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        distanceFromWarehouse: data.distanceFromWarehouse ?? null,

        placement: data.placement ?? null,
        instructions: data.instructions ?? null,
        customerNotes: data.customerNotes ?? data.notes ?? null,

        locationVerified: Boolean(data.locationVerified),
        locationVerificationNote: data.locationVerificationNote ?? null,

        timezone: tenantTimezone,

        deliveryDate: validated.deliveryDate,
        pickupDate: validated.pickupDate,
        pickupDateUnknown: validated.pickupDateUnknown,
        rentalDaysIncluded: pricing.rentalDaysIncluded,

        priorityDelivery: Boolean(data.priorityDelivery),
        deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        priorityDeliveryNote: data.priorityDeliveryNote ?? null,

        bookingStatus: BookingStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,

        basePrice: new Prisma.Decimal(pricing.basePrice),
        deliveryFee: new Prisma.Decimal(pricing.deliveryFee),
        mileageFee: new Prisma.Decimal(pricing.mileageFee),
        extraDaysFee: new Prisma.Decimal(pricing.extraDaysFee),
        overageFee: new Prisma.Decimal(pricing.overageFee),
        addonsTotal: new Prisma.Decimal(pricing.addonsTotal),
        total: new Prisma.Decimal(pricing.total),

        quotedAt: new Date(),
      },
    });

    await tx.bookingInventoryItem.deleteMany({
      where: {
        tenantId,
        bookingId: existingBooking.id,
      },
    });

    await tx.bookingInventoryItem.create({
      data: {
        tenantId,
        bookingId: existingBooking.id,
        inventoryItemId: inventoryItem.id,
        role: "PRIMARY",

        itemCategorySnapshot: inventoryItem.category,
        itemLabelSnapshot: inventoryItem.label,
        itemSizeValueSnapshot: inventoryItem.sizeValue,
        itemSizeUnitSnapshot: inventoryItem.sizeUnit,
        itemSerialSnapshot: inventoryItem.serialNumber,

        basePriceSnapshot: inventoryItem.basePrice,
        concretePriceSnapshot: inventoryItem.concretePrice,
      },
    });

    await tx.bookingAddon.deleteMany({
      where: {
        tenantId,
        bookingId: existingBooking.id,
      },
    });

    await createBookingAddonRows({
      tx,
      tenantId,
      bookingId: existingBooking.id,
      selectedAddons,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId: existingBooking.id,
        eventType: "PUBLIC_CHECKOUT_DRAFT_UPDATED",
        actorType: BookingActorType.CLIENT,
        actorLabel: validated.customerName,
        summary: "Public checkout draft was updated.",
        metadata: {
          customerEmail: validated.customerEmail,
          inventoryItemId: inventoryItem.id,
          total: pricing.total,
        },
      },
    });

    await tx.bookingNote.deleteMany({
      where: {
        tenantId,
        bookingId: existingBooking.id,
        visibility: NoteVisibility.CUSTOMER,
      },
    });

    if (data.customerNotes || data.notes) {
      await tx.bookingNote.create({
        data: {
          tenantId,
          bookingId: existingBooking.id,
          visibility: NoteVisibility.CUSTOMER,
          body: String(data.customerNotes || data.notes),
        },
      });
    }

    return tx.booking.findUnique({
      where: {
        id: existingBooking.id,
      },
      include: bookingInclude,
    });
  });

  if (!updatedBooking) {
    throw createServiceError("Failed to update checkout draft.", 500);
  }

  return getCheckoutDraftResponse(updatedBooking);
}

export async function getPublicBookingStatus({
  tenantId,
  bookingNumber,
  email,
}: GetPublicBookingStatusInput) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createServiceError("Email is required.", 400);
  }

  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      bookingNumber,
      customerEmail: normalizedEmail,
    },
    include: bookingInclude,
  });

  if (!booking) {
    return null;
  }

  return {
    bookingNumber: booking.bookingNumber,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    deliveryDate: booking.deliveryDate,
    pickupDate: booking.pickupDate,
    pickupDateUnknown: booking.pickupDateUnknown,
    total: normalizeMoney(booking.total),
    inventoryItem: normalizeInventoryItemForBookingResponse(
      getPrimaryInventoryItem(booking),
    ),

    // Temporary old frontend aliases.
    dumpster: normalizeInventoryItemForBookingResponse(
      getPrimaryInventoryItem(booking),
    ),
  };
}
