import {
  BookingActorType,
  BookingSource,
  BookingStatus,
  ClientType,
  NoteVisibility,
  PaymentStatus,
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
import {
  assertBookingRules,
  buildBookingPricingData,
  calculatePricing,
  getPricingContext,
  serializePricing,
} from "./booking-pricing.service.ts";
import {
  normalizeEmail,
  validatePublicBookingData,
  type ValidatedPublicBookingData,
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
  // Set by the server only (checkout drafts); never read from the request.
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
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

// Prices a public booking from tenant settings and the item. Prices sent by
// the browser are ignored.
async function pricePublicBooking({
  tenantId,
  validated,
  inventoryItem,
  selectedAddons,
  data,
}: {
  tenantId: string;
  validated: ValidatedPublicBookingData;
  inventoryItem: Parameters<typeof calculatePricing>[0]["inventoryItem"];
  selectedAddons: Parameters<typeof calculatePricing>[0]["selectedAddons"];
  data: any;
}) {
  const context = await getPricingContext(tenantId);

  assertBookingRules({
    context,
    fulfillmentType: validated.fulfillmentType,
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
  });

  return calculatePricing({
    context,
    inventoryItem,
    selectedAddons,
    fulfillmentType: validated.fulfillmentType,
    destination: {
      latitude: validated.latitude,
      longitude: validated.longitude,
    },
    deliveryDate: validated.deliveryDate,
    pickupDate: validated.pickupDate,
    priorityDelivery: validated.priorityDelivery,
    material: validated.material,
  });
}

export async function createPublicBookingQuote({
  tenantId,
  data,
}: CreatePublicBookingQuoteInput) {
  const validated = validatePublicBookingData(data, {
    requireCustomer: false,
    requireAddress: false,
  });

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

  const pricing = await pricePublicBooking({
    tenantId,
    validated,
    inventoryItem,
    selectedAddons,
    data,
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
      rentalDaysIncluded: inventoryItem.rentalDaysIncluded,
      extraDayRate: normalizeMoney(inventoryItem.extraDayRate),

      // Temporary old frontend aliases.
      dumpsterId: inventoryItem.id,
      dumpsterLabel: inventoryItem.label,
      dumpsterSize: inventoryItem.sizeValue
        ? Number(inventoryItem.sizeValue)
        : null,
    },
    pricing: serializePricing(pricing),
  };
}

export async function createPublicBooking({
  tenantId,
  tenantTimezone,
  data,
  bookingStatus = BookingStatus.QUOTE,
  paymentStatus = PaymentStatus.UNPAID,
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

  const pricing = await pricePublicBooking({
    tenantId,
    validated,
    inventoryItem,
    selectedAddons,
    data,
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

        latitude: validated.latitude,
        longitude: validated.longitude,

        placement: data.placement ?? null,
        instructions: data.instructions ?? null,
        customerNotes: data.customerNotes ?? data.notes ?? null,

        locationVerified: Boolean(data.locationVerified),
        locationVerificationNote: data.locationVerificationNote ?? null,

        timezone: tenantTimezone,

        deliveryDate: validated.deliveryDate,
        pickupDate: validated.pickupDate,
        pickupDateUnknown: validated.pickupDateUnknown,

        deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        priorityDeliveryNote: data.priorityDeliveryNote ?? null,

        bookingStatus,
        paymentStatus,

        source: BookingSource.WEB,
        ...buildBookingPricingData(pricing),

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
      addonLines: pricing.addonLines,
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
    data,
    bookingStatus: BookingStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING,
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

  const pricing = await pricePublicBooking({
    tenantId,
    validated,
    inventoryItem,
    selectedAddons,
    data,
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

        latitude: validated.latitude,
        longitude: validated.longitude,

        placement: data.placement ?? null,
        instructions: data.instructions ?? null,
        customerNotes: data.customerNotes ?? data.notes ?? null,

        locationVerified: Boolean(data.locationVerified),
        locationVerificationNote: data.locationVerificationNote ?? null,

        timezone: tenantTimezone,

        deliveryDate: validated.deliveryDate,
        pickupDate: validated.pickupDate,
        pickupDateUnknown: validated.pickupDateUnknown,

        deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        priorityDeliveryNote: data.priorityDeliveryNote ?? null,

        bookingStatus: BookingStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,

        ...buildBookingPricingData(pricing),

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
      addonLines: pricing.addonLines,
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
