import { parseDateOnly } from "../../utils/date.utils.ts";
import { createServiceError } from "../../utils/error.utils.ts";

export type ValidatedPublicBookingData = {
  inventoryItemId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  deliveryDate: Date;
  pickupDate: Date | null;
  pickupDateUnknown: boolean;
};

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function normalizePhone(phone?: string | null) {
  return phone?.replace(/\D/g, "") || null;
}

export function validatePublicBookingData(
  data: any,
): ValidatedPublicBookingData {
  const inventoryItemId =
    data.inventoryItemId ?? data.dumpsterId ?? data.itemId ?? null;

  if (!inventoryItemId) {
    throw createServiceError("Inventory item is required.", 400);
  }

  const customerName = String(data.customerName || data.name || "").trim();

  if (!customerName) {
    throw createServiceError("Customer name is required.", 400);
  }

  const customerEmail = normalizeEmail(data.customerEmail || data.email);

  if (!customerEmail) {
    throw createServiceError("Customer email is required.", 400);
  }

  const customerPhone = normalizePhone(data.customerPhone || data.phone);

  if (!customerPhone) {
    throw createServiceError("Customer phone is required.", 400);
  }

  const address1 = String(data.address1 || "").trim();
  const city = String(data.city || "").trim();
  const state = String(data.state || "").trim();
  const zip = String(data.zip || "").trim();

  if (!address1 || !city || !state || !zip) {
    throw createServiceError("Delivery address is required.", 400);
  }

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
    inventoryItemId: String(inventoryItemId),
    customerName,
    customerEmail,
    customerPhone,
    address1,
    city,
    state,
    zip,
    deliveryDate,
    pickupDate,
    pickupDateUnknown,
  };
}
