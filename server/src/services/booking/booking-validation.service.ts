import { FulfillmentType } from "../../generated/prisma/client.ts";
import { parseDateOnly } from "../../utils/date.utils.ts";
import { createServiceError } from "../../utils/error.utils.ts";

import { parseFulfillmentType } from "./booking-pricing.service.ts";

export type ValidatedPublicBookingData = {
  latitude: number | null;
  longitude: number | null;
  inventoryItemId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  priorityDelivery: boolean;
  material: string | null;
  deliveryDate: Date;
  pickupDate: Date | null;
  pickupDateUnknown: boolean;
};

function parseCoordinate(value: unknown, field: string, limit: number) {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number) || Math.abs(number) > limit) {
    throw createServiceError(`Invalid ${field}.`, 400);
  }

  return number;
}

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function normalizePhone(phone?: string | null) {
  return phone?.replace(/\D/g, "") || null;
}

export function validatePublicBookingData(
  data: any,
  // Quotes are requested before the customer step and only need the
  // address coordinates (for mileage), so they skip contact info and the
  // street address.
  {
    requireCustomer = true,
    requireAddress = true,
  }: { requireCustomer?: boolean; requireAddress?: boolean } = {},
): ValidatedPublicBookingData {
  const inventoryItemId =
    data.inventoryItemId ?? data.dumpsterId ?? data.itemId ?? null;

  if (!inventoryItemId) {
    throw createServiceError("Inventory item is required.", 400);
  }

  const customerName = String(data.customerName || data.name || "").trim();

  if (requireCustomer && !customerName) {
    throw createServiceError("Customer name is required.", 400);
  }

  const customerEmail = normalizeEmail(data.customerEmail || data.email) ?? "";

  if (requireCustomer && !customerEmail) {
    throw createServiceError("Customer email is required.", 400);
  }

  const customerPhone = normalizePhone(data.customerPhone || data.phone) ?? "";

  if (requireCustomer && !customerPhone) {
    throw createServiceError("Customer phone is required.", 400);
  }

  const fulfillmentType = parseFulfillmentType(data.fulfillmentType);

  const address1 = String(data.address1 || "").trim() || null;
  const city = String(data.city || "").trim() || null;
  const state = String(data.state || "").trim() || null;
  const zip = String(data.zip || "").trim() || null;

  if (
    requireAddress &&
    fulfillmentType === FulfillmentType.DELIVERY &&
    (!address1 || !city || !state || !zip)
  ) {
    throw createServiceError("Delivery address is required.", 400);
  }

  // The booking form sends priority delivery inside its add-on toggles.
  const priorityDelivery = Boolean(
    data.priorityDelivery ?? data.addons?.priorityDelivery,
  );

  const material = String(data.material || "").trim().slice(0, 60) || null;

  // Map coordinates of the delivery address (used for mileage pricing).
  const latitude =
    fulfillmentType === FulfillmentType.DELIVERY
      ? parseCoordinate(data.latitude, "latitude", 90)
      : null;
  const longitude =
    fulfillmentType === FulfillmentType.DELIVERY
      ? parseCoordinate(data.longitude, "longitude", 180)
      : null;

  const deliveryDate = parseDateOnly(data.deliveryDate);

  if (!deliveryDate) {
    throw createServiceError("Delivery date is required.", 400);
  }

  const pickupDateUnknown = Boolean(data.pickupDateUnknown);
  const pickupDate = pickupDateUnknown ? null : parseDateOnly(data.pickupDate);

  if (!pickupDateUnknown && !pickupDate) {
    throw createServiceError("Pickup date is required.", 400);
  }

  if (pickupDate && pickupDate < deliveryDate) {
    throw createServiceError(
      "Pickup date cannot be before delivery date.",
      400,
    );
  }

  return {
    latitude,
    longitude,
    inventoryItemId: String(inventoryItemId),
    customerName,
    customerEmail,
    customerPhone,
    fulfillmentType,
    address1,
    city,
    state,
    zip,
    priorityDelivery,
    material,
    deliveryDate,
    pickupDate,
    pickupDateUnknown,
  };
}
