import {
  AddonPriceType,
  FulfillmentType,
  Prisma,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";
import { addUtcDays, parseDateOnly } from "../../utils/date.utils.ts";

import type { SelectedAddon } from "./booking-addons.service.ts";

/**
 * All booking prices are calculated here, on the server, from the tenant's
 * TenantSettings and the inventory item. Amounts sent by the browser
 * (basePrice, mileageFee, total, ...) are never used.
 */

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

export type PricingSettings = {
  allowDelivery: boolean;
  allowCustomerPickup: boolean;
  deliveryFee: DecimalLike;
  freeDeliveryMiles: DecimalLike;
  perMileRate: DecimalLike;
  maxDeliveryMiles: DecimalLike;
  priorityDeliveryFee: DecimalLike;
  minNoticeDays: number;
  maxRentalDays: number;
  taxRate: DecimalLike;
};

export type PricingContext = {
  settings: PricingSettings;
  origin: Coordinates | null;
  timezone: string;
};

type Coordinates = { latitude: number; longitude: number };

// Used when a tenant has no settings row yet: nothing extra is charged.
const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  allowDelivery: true,
  allowCustomerPickup: false,
  deliveryFee: 0,
  freeDeliveryMiles: 0,
  perMileRate: 0,
  maxDeliveryMiles: null,
  priorityDeliveryFee: 0,
  minNoticeDays: 0,
  maxRentalDays: 60,
  taxRate: 0,
};

// Debris types that add the item's concretePrice as materialFee.
const HEAVY_MATERIALS = new Set(["concrete"]);

function toNumber(value: DecimalLike) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toNullableNumber(value: DecimalLike) {
  if (value === null || value === undefined || value === "") return null;
  return toNumber(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toCoordinates(latitude: unknown, longitude: unknown) {
  const lat = toNullableNumber(latitude as DecimalLike);
  const lng = toNullableNumber(longitude as DecimalLike);

  if (lat === null || lng === null) return null;

  return { latitude: lat, longitude: lng };
}

// Straight-line (haversine) miles; same method the booking form shows.
export function getDistanceMiles(from: Coordinates, to: Coordinates) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Days between delivery and pickup; null while the pickup date is unknown.
export function getRentalDays(deliveryDate: Date, pickupDate: Date | null) {
  if (!pickupDate) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = pickupDate.getTime() - deliveryDate.getTime();

  return Math.max(1, Math.round(diff / msPerDay));
}

export function parseFulfillmentType(value: unknown): FulfillmentType {
  if (value === undefined || value === null || value === "") {
    return FulfillmentType.DELIVERY;
  }

  const normalized = String(value).trim().toUpperCase();

  if (normalized === FulfillmentType.DELIVERY) return FulfillmentType.DELIVERY;
  if (normalized === FulfillmentType.CUSTOMER_PICKUP) {
    return FulfillmentType.CUSTOMER_PICKUP;
  }

  throw createServiceError(
    "fulfillmentType must be DELIVERY or CUSTOMER_PICKUP.",
    400,
  );
}

export async function getPricingContext(
  tenantId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PricingContext> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      latitude: true,
      longitude: true,
      timezone: true,
      settings: true,
    },
  });

  if (!tenant) {
    throw createServiceError("Tenant not found.", 404);
  }

  return {
    settings: tenant.settings ?? DEFAULT_PRICING_SETTINGS,
    origin: toCoordinates(tenant.latitude, tenant.longitude),
    timezone: tenant.timezone,
  };
}

/**
 * Settings the public booking form needs to show options and explain fees.
 * Prices themselves still come from the quote endpoint.
 */
export async function getPublicBookingSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      phone: true,
      address1: true,
      address2: true,
      city: true,
      state: true,
      zip: true,
      timezone: true,
      settings: true,
    },
  });

  if (!tenant) {
    throw createServiceError("Tenant not found.", 404);
  }

  const settings = tenant.settings ?? DEFAULT_PRICING_SETTINGS;

  return {
    allowDelivery: settings.allowDelivery,
    allowCustomerPickup: settings.allowCustomerPickup,
    deliveryFee: toNumber(settings.deliveryFee),
    freeDeliveryMiles: toNumber(settings.freeDeliveryMiles),
    perMileRate: toNumber(settings.perMileRate),
    maxDeliveryMiles:
      settings.maxDeliveryMiles == null
        ? null
        : Number(settings.maxDeliveryMiles),
    priorityDeliveryFee: toNumber(settings.priorityDeliveryFee),
    minNoticeDays: settings.minNoticeDays,
    maxRentalDays: settings.maxRentalDays,
    taxRate: toNumber(settings.taxRate),
    timezone: tenant.timezone,
    // Where customer-pickup bookings collect the item.
    pickupLocation: {
      name: tenant.name,
      phone: tenant.phone,
      address1: tenant.address1,
      address2: tenant.address2,
      city: tenant.city,
      state: tenant.state,
      zip: tenant.zip,
    },
  };
}

function getTodayInTimezone(timezone: string) {
  // en-CA formats as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return parseDateOnly(today)!;
}

/**
 * Tenant booking rules for customer-facing bookings. Admin bookings skip
 * these so staff can make exceptions.
 */
export function assertBookingRules({
  context,
  fulfillmentType,
  deliveryDate,
  pickupDate,
}: {
  context: PricingContext;
  fulfillmentType: FulfillmentType;
  deliveryDate: Date;
  pickupDate: Date | null;
}) {
  const { settings } = context;

  if (fulfillmentType === FulfillmentType.DELIVERY && !settings.allowDelivery) {
    throw createServiceError("Delivery is not available.", 400);
  }

  if (
    fulfillmentType === FulfillmentType.CUSTOMER_PICKUP &&
    !settings.allowCustomerPickup
  ) {
    throw createServiceError("Customer pickup is not available.", 400);
  }

  const earliestDate = addUtcDays(
    getTodayInTimezone(context.timezone),
    settings.minNoticeDays,
  );

  if (deliveryDate < earliestDate) {
    throw createServiceError(
      settings.minNoticeDays > 0
        ? `Bookings need at least ${settings.minNoticeDays} day(s) notice.`
        : "Delivery date cannot be in the past.",
      400,
    );
  }

  const rentalDays = getRentalDays(deliveryDate, pickupDate);

  if (rentalDays !== null && rentalDays > settings.maxRentalDays) {
    throw createServiceError(
      `Rentals can be booked for up to ${settings.maxRentalDays} days.`,
      400,
    );
  }
}

export type PricingItem = {
  category: string;
  basePrice: DecimalLike;
  concretePrice: DecimalLike;
  rentalDaysIncluded: number;
  extraDayRate: DecimalLike;
};

export type PricedAddonLine = {
  selectedAddon: SelectedAddon;
  priceType: AddonPriceType;
  lineTotal: number;
};

export type BookingPricing = ReturnType<typeof calculatePricing>;

export function calculatePricing({
  context,
  inventoryItem,
  selectedAddons,
  fulfillmentType,
  destination,
  deliveryDate,
  pickupDate,
  priorityDelivery,
  material,
  discountAmount = 0,
}: {
  context: PricingContext;
  inventoryItem: PricingItem;
  selectedAddons: SelectedAddon[];
  fulfillmentType: FulfillmentType;
  destination: { latitude?: unknown; longitude?: unknown } | null;
  deliveryDate: Date;
  pickupDate: Date | null;
  priorityDelivery: boolean;
  material: string | null;
  discountAmount?: number;
}) {
  const { settings } = context;
  const isDelivery = fulfillmentType === FulfillmentType.DELIVERY;

  // Rental days
  const rentalDaysIncluded = inventoryItem.rentalDaysIncluded;
  const rentalDays = getRentalDays(deliveryDate, pickupDate);
  const extraDays =
    rentalDays === null ? 0 : Math.max(0, rentalDays - rentalDaysIncluded);
  const extraDayRate = toNumber(inventoryItem.extraDayRate);
  const extraDaysFee = roundMoney(extraDays * extraDayRate);

  // Delivery and mileage
  const deliveryFee = isDelivery ? toNumber(settings.deliveryFee) : 0;
  const perMileRate = isDelivery ? toNumber(settings.perMileRate) : 0;
  const destinationCoordinates = destination
    ? toCoordinates(destination.latitude, destination.longitude)
    : null;

  let distanceMiles: number | null = null;

  if (isDelivery && context.origin && destinationCoordinates) {
    distanceMiles =
      Math.round(getDistanceMiles(context.origin, destinationCoordinates) * 100) /
      100;
  }

  if (isDelivery && perMileRate > 0 && distanceMiles === null) {
    if (!context.origin) {
      // Tenant location isn't set; can't charge mileage. Fix in settings.
      console.warn(
        "Mileage pricing is on but the tenant has no latitude/longitude.",
      );
    } else {
      throw createServiceError(
        "Please choose the delivery address from the suggestions so we can calculate delivery.",
        400,
      );
    }
  }

  const maxDeliveryMiles = toNullableNumber(settings.maxDeliveryMiles);

  if (
    isDelivery &&
    distanceMiles !== null &&
    maxDeliveryMiles !== null &&
    distanceMiles > maxDeliveryMiles
  ) {
    throw createServiceError(
      `This address is outside our delivery area (${maxDeliveryMiles} miles).`,
      400,
    );
  }

  const billableMiles =
    distanceMiles === null
      ? 0
      : Math.max(
          0,
          Math.round(
            (distanceMiles - toNumber(settings.freeDeliveryMiles)) * 100,
          ) / 100,
        );
  const mileageFee = roundMoney(billableMiles * perMileRate);

  const priorityDeliveryFee =
    isDelivery && priorityDelivery
      ? toNumber(settings.priorityDeliveryFee)
      : 0;

  // Item and material
  const basePrice = toNumber(inventoryItem.basePrice);
  const normalizedMaterial = material ? material.trim().toLowerCase() : null;
  const materialFee =
    normalizedMaterial && HEAVY_MATERIALS.has(normalizedMaterial)
      ? toNumber(inventoryItem.concretePrice)
      : 0;

  // Add-ons
  const addonDays = rentalDays ?? rentalDaysIncluded;
  const addonLines: PricedAddonLine[] = selectedAddons.map((selectedAddon) => {
    const { addon, quantity } = selectedAddon;

    if (addon.category && addon.category !== inventoryItem.category) {
      throw createServiceError(
        `${addon.name} is not available for this item.`,
        400,
      );
    }

    const priceType = addon.priceType ?? AddonPriceType.FLAT;
    const days = priceType === AddonPriceType.PER_DAY ? addonDays : 1;

    return {
      selectedAddon,
      priceType,
      lineTotal: roundMoney(toNumber(addon.price) * quantity * days),
    };
  });

  const addonsTotal = roundMoney(
    addonLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  // Overage (overweight etc.) is assessed by staff after pickup.
  const overageFee = 0;

  const linesTotal = roundMoney(
    basePrice +
      deliveryFee +
      mileageFee +
      priorityDeliveryFee +
      extraDaysFee +
      materialFee +
      overageFee +
      addonsTotal,
  );

  const discount = roundMoney(
    Math.min(Math.max(0, discountAmount), linesTotal),
  );
  const subtotal = roundMoney(linesTotal - discount);
  const taxRate = toNumber(settings.taxRate);
  const taxAmount = roundMoney(subtotal * taxRate);
  const total = roundMoney(subtotal + taxAmount);

  return {
    fulfillmentType,
    rentalDays,
    rentalDaysIncluded,
    extraDays,
    extraDayRate,
    extraDaysFee,

    distanceMiles,
    billableMiles,
    perMileRate,
    deliveryFee,
    mileageFee,
    priorityDelivery: isDelivery && priorityDelivery,
    priorityDeliveryFee,

    basePrice,
    material: normalizedMaterial,
    materialFee,
    overageFee,

    addonLines,
    addonsTotal,

    discountAmount: discount,
    subtotal,
    taxRate,
    taxAmount,
    total,
  };
}

// Booking columns written from a pricing result.
export function buildBookingPricingData(pricing: BookingPricing) {
  const decimal = (value: number) => new Prisma.Decimal(value);

  return {
    fulfillmentType: pricing.fulfillmentType,
    material: pricing.material,
    distanceFromWarehouse:
      pricing.distanceMiles === null ? null : decimal(pricing.distanceMiles),

    rentalDaysIncluded: pricing.rentalDaysIncluded,
    priorityDelivery: pricing.priorityDelivery,

    basePrice: decimal(pricing.basePrice),
    deliveryFee: decimal(pricing.deliveryFee),
    billableMiles: decimal(pricing.billableMiles),
    perMileRate: decimal(pricing.perMileRate),
    mileageFee: decimal(pricing.mileageFee),
    priorityDeliveryFee: decimal(pricing.priorityDeliveryFee),
    extraDays: pricing.extraDays,
    extraDayRate: decimal(pricing.extraDayRate),
    extraDaysFee: decimal(pricing.extraDaysFee),
    materialFee: decimal(pricing.materialFee),
    overageFee: decimal(pricing.overageFee),
    addonsTotal: decimal(pricing.addonsTotal),

    discountAmount: decimal(pricing.discountAmount),
    subtotal: decimal(pricing.subtotal),
    taxRate: decimal(pricing.taxRate),
    taxAmount: decimal(pricing.taxAmount),
    total: decimal(pricing.total),
  };
}

// Plain-number breakdown for API responses (quotes, checkout summary).
export function serializePricing(pricing: BookingPricing) {
  const { addonLines, ...rest } = pricing;

  return {
    ...rest,
    addons: addonLines.map((line) => ({
      id: line.selectedAddon.addon.id,
      code: line.selectedAddon.addon.code,
      name: line.selectedAddon.addon.name,
      price: toNumber(line.selectedAddon.addon.price),
      priceType: line.priceType,
      quantity: line.selectedAddon.quantity,
      lineTotal: line.lineTotal,
    })),
  };
}

type SavedBookingForTotals = {
  deliveryDate: Date;
  pickupDate: Date | null;
  rentalDaysIncluded: number | null;
  extraDayRate: DecimalLike;
  basePrice: DecimalLike;
  deliveryFee: DecimalLike;
  mileageFee: DecimalLike;
  priorityDeliveryFee: DecimalLike;
  materialFee: DecimalLike;
  overageFee: DecimalLike;
  discountAmount: DecimalLike;
  taxRate: DecimalLike;
  addons: {
    id: string;
    addonPriceTypeSnapshot: AddonPriceType;
    addonPriceSnapshot: DecimalLike;
    quantity: number;
    lineTotal: DecimalLike;
  }[];
};

/**
 * Derived amounts for a saved booking: extra days (from its dates and the
 * rental terms stored on the booking), per-day add-on lines, add-ons total,
 * subtotal, tax and total. Pure, so it can also preview a date change.
 *
 * Rates already on the booking (base price, delivery, mileage, extra-day
 * rate, tax rate...) are kept as agreed; tenant settings are not re-read,
 * so changing settings later never silently reprices old bookings.
 */
export function computeBookingTotals(booking: SavedBookingForTotals) {
  const rentalDays = getRentalDays(booking.deliveryDate, booking.pickupDate);
  const rentalDaysIncluded = booking.rentalDaysIncluded ?? 0;
  const extraDayRate = toNumber(booking.extraDayRate);

  const extraDays =
    rentalDays === null ? 0 : Math.max(0, rentalDays - rentalDaysIncluded);
  const extraDaysFee = roundMoney(extraDays * extraDayRate);

  // Per-day add-ons follow the rental length; flat ones keep their total.
  const addonLines = booking.addons.map((addon) => {
    const lineTotal =
      addon.addonPriceTypeSnapshot === AddonPriceType.PER_DAY
        ? roundMoney(
            toNumber(addon.addonPriceSnapshot) *
              addon.quantity *
              (rentalDays ?? rentalDaysIncluded),
          )
        : toNumber(addon.lineTotal);

    return {
      id: addon.id,
      lineTotal,
      changed: lineTotal !== toNumber(addon.lineTotal),
    };
  });

  const addonsTotal = roundMoney(
    addonLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  const linesTotal = roundMoney(
    toNumber(booking.basePrice) +
      toNumber(booking.deliveryFee) +
      toNumber(booking.mileageFee) +
      toNumber(booking.priorityDeliveryFee) +
      extraDaysFee +
      toNumber(booking.materialFee) +
      toNumber(booking.overageFee) +
      addonsTotal,
  );

  const discountAmount = roundMoney(
    Math.min(Math.max(0, toNumber(booking.discountAmount)), linesTotal),
  );
  const subtotal = roundMoney(linesTotal - discountAmount);
  const taxAmount = roundMoney(subtotal * toNumber(booking.taxRate));
  const total = roundMoney(subtotal + taxAmount);

  return {
    rentalDays,
    extraDays,
    extraDayRate,
    extraDaysFee,
    addonLines,
    addonsTotal,
    discountAmount,
    subtotal,
    taxAmount,
    total,
  };
}

/** Saves computeBookingTotals() onto a booking after an admin edit. */
export async function recalculateBookingTotals(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { addons: true },
  });

  if (!booking) {
    throw createServiceError("Booking not found.", 404);
  }

  const totals = computeBookingTotals(booking);

  for (const line of totals.addonLines) {
    if (line.changed) {
      await tx.bookingAddon.update({
        where: { id: line.id },
        data: { lineTotal: new Prisma.Decimal(line.lineTotal) },
      });
    }
  }

  return tx.booking.update({
    where: { id: bookingId },
    data: {
      extraDays: totals.extraDays,
      extraDaysFee: new Prisma.Decimal(totals.extraDaysFee),
      addonsTotal: new Prisma.Decimal(totals.addonsTotal),
      discountAmount: new Prisma.Decimal(totals.discountAmount),
      subtotal: new Prisma.Decimal(totals.subtotal),
      taxAmount: new Prisma.Decimal(totals.taxAmount),
      total: new Prisma.Decimal(totals.total),
    },
  });
}
