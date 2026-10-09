import {
  BookingSource,
  BookingStatus,
  ClientType,
  NoteVisibility,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentType,
  Prisma,
  ServiceType,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";

import {
  checkInventoryAvailability,
  findInventoryItemOrThrow,
} from "./booking-availability.service.ts";
import {
  createBookingAddonRows,
  getSelectedAddons,
} from "./booking-addons.service.ts";
import { createAdminBookingHistory } from "./booking-history.service.ts";
import { generateBookingNumber } from "./booking-number.service.ts";
import {
  bookingDetailInclude,
  normalizeBookingDetail,
} from "./booking-normalizer.service.ts";
import {
  buildBookingPricingData,
  calculatePricing,
  getPricingContext,
  serializePricing,
} from "./booking-pricing.service.ts";
import {
  normalizeEmail,
  validatePublicBookingData,
} from "./booking-validation.service.ts";

/**
 * Bookings entered by staff (phone calls, walk-ins). Priced by the same
 * server-side calculation as web bookings, plus an optional discount. Tenant
 * booking rules (notice, max days) are not enforced so staff can make
 * exceptions; availability still is.
 */

type AdminBookingInput = {
  tenantId: string;
  data: any;
};

type CreateAdminBookingInput = AdminBookingInput & {
  actorLabel: string;
  userId: string | null;
};

function parseEnum<T extends string>(
  enumObject: Record<string, T>,
  value: unknown,
  fallback: T,
  field: string,
): T {
  if (value === undefined || value === null || value === "") return fallback;

  const allowed = Object.values(enumObject);

  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }

  throw createServiceError(
    `Invalid ${field}. Expected one of: ${allowed.join(", ")}.`,
    400,
  );
}

function parseDiscount(data: any) {
  const discountAmount = Number(data.discountAmount || 0);

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    throw createServiceError("discountAmount must be 0 or more.", 400);
  }

  const discountReason = String(data.discountReason || "").trim() || null;

  if (discountAmount > 0 && !discountReason) {
    throw createServiceError("Add a reason for the discount.", 400);
  }

  return { discountAmount, discountReason };
}

async function priceAdminBooking({
  tenantId,
  data,
  requireCustomer,
}: AdminBookingInput & { requireCustomer: boolean }) {
  // Customer fields are checked below: staff bookings need a phone, but
  // email is optional.
  // The admin quote has no street address yet; creating the booking does.
  const validated = validatePublicBookingData(data, {
    requireCustomer: false,
    requireAddress: requireCustomer,
  });

  if (requireCustomer) {
    if (!validated.customerName) {
      throw createServiceError("Customer name is required.", 400);
    }

    if (!validated.customerPhone) {
      throw createServiceError("Customer phone is required.", 400);
    }
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
  });

  const selectedAddons = await getSelectedAddons({ tenantId, data });
  const context = await getPricingContext(tenantId);
  const { discountAmount, discountReason } = parseDiscount(data);

  const pricing = calculatePricing({
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
    discountAmount,
  });

  return {
    validated,
    inventoryItem,
    pricing,
    discountReason,
    timezone: context.timezone,
  };
}

// Live price preview for the admin New Booking form.
export async function quoteAdminBooking({ tenantId, data }: AdminBookingInput) {
  const { pricing } = await priceAdminBooking({
    tenantId,
    data,
    requireCustomer: false,
  });

  return { pricing: serializePricing(pricing) };
}

async function findOrCreateClient({
  tx,
  tenantId,
  clientType,
  customerName,
  customerEmail,
  customerPhone,
  data,
  address,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  clientType: ClientType;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  data: any;
  address: {
    address1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
}) {
  const existing = await tx.client.findFirst({
    where: customerEmail
      ? { tenantId, email: customerEmail }
      : { tenantId, phone: customerPhone },
  });

  if (existing) return existing;

  return tx.client.create({
    data: {
      tenant: { connect: { id: tenantId } },
      clientType,
      displayName: customerName,
      email: customerEmail,
      phone: customerPhone,
      businessName: data.businessName ?? null,
      businessEmail: data.businessEmail ?? null,
      businessPhone: data.businessPhone ?? null,
      address1: address.address1,
      address2: data.address2 ?? null,
      city: address.city,
      state: address.state,
      zip: address.zip,
    },
  });
}

export async function createAdminBooking({
  tenantId,
  data,
  actorLabel,
  userId,
}: CreateAdminBookingInput) {
  const { validated, inventoryItem, pricing, discountReason, timezone } =
    await priceAdminBooking({ tenantId, data, requireCustomer: true });

  const bookingStatus = parseEnum(
    BookingStatus,
    data.bookingStatus,
    BookingStatus.SCHEDULED,
    "bookingStatus",
  );
  const paymentStatus = parseEnum(
    PaymentStatus,
    data.paymentStatus,
    PaymentStatus.UNPAID,
    "paymentStatus",
  );
  const source = parseEnum(
    BookingSource,
    data.source,
    BookingSource.PHONE,
    "source",
  );
  const clientType = parseEnum(
    ClientType,
    data.clientType ?? data.customerType,
    ClientType.INDIVIDUAL,
    "clientType",
  );

  const customerEmail = normalizeEmail(validated.customerEmail);
  const now = new Date();
  const isPaid = paymentStatus === PaymentStatus.PAID;
  const isScheduled =
    bookingStatus === BookingStatus.SCHEDULED ||
    bookingStatus === BookingStatus.CONFIRMED;

  const bookingNumber = await generateBookingNumber(tenantId);

  const booking = await prisma.$transaction(async (tx) => {
    const client = await findOrCreateClient({
      tx,
      tenantId,
      clientType,
      customerName: validated.customerName,
      customerEmail,
      customerPhone: validated.customerPhone,
      data,
      address: validated,
    });

    const createdBooking = await tx.booking.create({
      data: {
        tenant: { connect: { id: tenantId } },
        client: { connect: { id: client.id } },
        ...(userId ? { createdBy: { connect: { id: userId } } } : {}),

        bookingNumber,

        serviceType: parseEnum(
          ServiceType,
          data.serviceType,
          ServiceType.DUMPSTER_RENTAL,
          "serviceType",
        ),
        projectType: data.projectType || null,

        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail,

        clientType,
        businessName: data.businessName ?? null,
        businessEmail: data.businessEmail ?? null,
        businessPhone: data.businessPhone ?? null,

        address1: validated.address1,
        address2: data.address2 || null,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,

        latitude: validated.latitude,
        longitude: validated.longitude,

        placement: data.placement || null,
        instructions: data.instructions || null,
        customerNotes: data.customerNotes || null,

        // Staff confirmed the location on the call.
        locationVerified: Boolean(data.locationVerified),

        timezone,

        deliveryDate: validated.deliveryDate,
        pickupDate: validated.pickupDate,
        pickupDateUnknown: validated.pickupDateUnknown,

        bookingStatus,
        paymentStatus,

        source,
        ...buildBookingPricingData(pricing),
        discountReason,

        quotedAt: now,
        ...(isScheduled ? { confirmedAt: now, scheduledAt: now } : {}),
        ...(isPaid ? { paidAt: now } : {}),
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

    // Paid outside Stripe (cash, check, card over the phone): record it in
    // the payment ledger so revenue reports include it.
    if (isPaid) {
      await tx.payment.create({
        data: {
          tenantId,
          bookingId: createdBooking.id,
          type: PaymentType.CHARGE,
          status: PaymentTransactionStatus.SUCCEEDED,
          amount: new Prisma.Decimal(pricing.total),
          paidAt: now,
        },
      });
    }

    if (data.customerNotes) {
      await tx.bookingNote.create({
        data: {
          tenantId,
          bookingId: createdBooking.id,
          visibility: NoteVisibility.CUSTOMER,
          body: String(data.customerNotes),
        },
      });
    }

    if (data.internalNotes) {
      await tx.bookingNote.create({
        data: {
          tenantId,
          bookingId: createdBooking.id,
          visibility: NoteVisibility.INTERNAL,
          body: String(data.internalNotes),
        },
      });
    }

    await createAdminBookingHistory({
      tx,
      tenantId,
      bookingId: createdBooking.id,
      actorLabel,
      eventType: "ADMIN_BOOKING_CREATED",
      summary: `Admin created booking (${source.toLowerCase()}).`,
      metadata: {
        inventoryItemId: inventoryItem.id,
        total: pricing.total,
        discountAmount: pricing.discountAmount,
        discountReason,
      },
    });

    return tx.booking.findUnique({
      where: { id: createdBooking.id },
      include: bookingDetailInclude,
    });
  });

  if (!booking) {
    throw createServiceError("Failed to create booking.", 500);
  }

  return normalizeBookingDetail(booking);
}
