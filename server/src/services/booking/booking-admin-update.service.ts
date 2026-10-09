import {
  BookingStatus,
  FulfillmentType,
  PaymentStatus,
  Prisma,
} from "../../generated/prisma/client.ts";

import { createServiceError } from "../../utils/error.utils.ts";
import { parseDateOnly } from "../../utils/date.utils.ts";
import { toDecimal } from "../../utils/prisma.utils.ts";

function requireDateOnly(value: unknown, fieldName: string) {
  const date = parseDateOnly(value);

  if (!date) {
    throw createServiceError(
      `${fieldName} must be a valid YYYY-MM-DD date.`,
      400,
    );
  }

  return date;
}

function parseEnumValue<T extends string>(
  enumObject: Record<string, T>,
  value: unknown,
  field: string,
): T {
  const allowed = Object.values(enumObject);

  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }

  throw createServiceError(
    `Invalid ${field}. Expected one of: ${allowed.join(", ")}.`,
    400,
  );
}

function requireMoney(value: unknown, fieldName: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw createServiceError(`${fieldName} must be 0 or more.`, 400);
  }

  return toDecimal(number);
}

/**
 * Fields that change what the booking costs. When any of these are edited,
 * updateAdminBooking recalculates extra days, add-ons, subtotal, tax and
 * total on the server.
 */
export const ADMIN_PRICING_FIELDS = [
  "deliveryDate",
  "pickupDate",
  "pickupDateUnknown",
  "rentalDaysIncluded",
  "extraDayRate",
  "priorityDelivery",
  "basePrice",
  "deliveryFee",
  "mileageFee",
  "priorityDeliveryFee",
  "materialFee",
  "overageFee",
  "discountAmount",
];

export function normalizeAdminBookingUpdateData(
  data: any,
): Prisma.BookingUpdateInput {
  return {
    ...(data.customerName !== undefined
      ? { customerName: data.customerName }
      : {}),
    ...(data.customerPhone !== undefined
      ? { customerPhone: data.customerPhone }
      : {}),
    ...(data.customerEmail !== undefined
      ? { customerEmail: data.customerEmail }
      : {}),

    ...(data.clientType !== undefined ? { clientType: data.clientType } : {}),
    ...(data.businessName !== undefined
      ? { businessName: data.businessName }
      : {}),
    ...(data.businessPhone !== undefined
      ? { businessPhone: data.businessPhone }
      : {}),
    ...(data.businessEmail !== undefined
      ? { businessEmail: data.businessEmail }
      : {}),

    ...(data.address1 !== undefined ? { address1: data.address1 } : {}),
    ...(data.address2 !== undefined ? { address2: data.address2 } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.state !== undefined ? { state: data.state } : {}),
    ...(data.zip !== undefined ? { zip: data.zip } : {}),

    /**
     * Only keep this if Booking actually has country.
     * Earlier your schema looked like country was on Client, not Booking.
     */
    ...(data.country !== undefined ? { country: data.country } : {}),

    ...(data.placement !== undefined ? { placement: data.placement } : {}),
    ...(data.instructions !== undefined
      ? { instructions: data.instructions }
      : {}),
    ...(data.customerNotes !== undefined
      ? { customerNotes: data.customerNotes }
      : {}),

    ...(data.locationVerified !== undefined
      ? { locationVerified: data.locationVerified }
      : {}),
    ...(data.locationVerificationNote !== undefined
      ? { locationVerificationNote: data.locationVerificationNote }
      : {}),

    ...(data.deliveryDate !== undefined
      ? {
          deliveryDate: requireDateOnly(data.deliveryDate, "Delivery date"),
        }
      : {}),

    ...(data.pickupDate !== undefined
      ? {
          pickupDate: data.pickupDate
            ? requireDateOnly(data.pickupDate, "Pickup date")
            : null,
        }
      : {}),

    ...(data.pickupDateUnknown !== undefined
      ? {
          pickupDateUnknown: Boolean(data.pickupDateUnknown),
          ...(data.pickupDateUnknown ? { pickupDate: null } : {}),
        }
      : {}),

    ...(data.rentalDaysIncluded !== undefined
      ? {
          rentalDaysIncluded: (() => {
            const days = Number(data.rentalDaysIncluded);

            if (!Number.isInteger(days) || days < 0) {
              throw createServiceError(
                "Rental days included must be a whole number.",
                400,
              );
            }

            return days;
          })(),
        }
      : {}),

    ...(data.priorityDelivery !== undefined
      ? { priorityDelivery: Boolean(data.priorityDelivery) }
      : {}),

    ...(data.deliveryTime !== undefined
      ? {
          deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        }
      : {}),

    ...(data.priorityDeliveryNote !== undefined
      ? { priorityDeliveryNote: data.priorityDeliveryNote }
      : {}),

    ...(data.bookingStatus !== undefined
      ? {
          bookingStatus: parseEnumValue(
            BookingStatus,
            data.bookingStatus,
            "bookingStatus",
          ),
        }
      : {}),
    ...(data.paymentStatus !== undefined
      ? {
          paymentStatus: parseEnumValue(
            PaymentStatus,
            data.paymentStatus,
            "paymentStatus",
          ),
        }
      : {}),

    // Price lines staff may adjust. Extra-days fee, add-ons total,
    // subtotal, tax and total are always recalculated, never taken from the
    // request.
    ...(data.basePrice !== undefined
      ? { basePrice: requireMoney(data.basePrice, "Base price") }
      : {}),
    ...(data.deliveryFee !== undefined
      ? { deliveryFee: requireMoney(data.deliveryFee, "Delivery fee") }
      : {}),
    ...(data.mileageFee !== undefined
      ? { mileageFee: requireMoney(data.mileageFee, "Mileage fee") }
      : {}),
    ...(data.priorityDeliveryFee !== undefined
      ? {
          priorityDeliveryFee: requireMoney(
            data.priorityDeliveryFee,
            "Priority delivery fee",
          ),
        }
      : {}),
    ...(data.extraDayRate !== undefined
      ? { extraDayRate: requireMoney(data.extraDayRate, "Extra day rate") }
      : {}),
    ...(data.materialFee !== undefined
      ? { materialFee: requireMoney(data.materialFee, "Material fee") }
      : {}),
    ...(data.overageFee !== undefined
      ? { overageFee: requireMoney(data.overageFee, "Overage fee") }
      : {}),
    ...(data.discountAmount !== undefined
      ? { discountAmount: requireMoney(data.discountAmount, "Discount") }
      : {}),
    ...(data.discountReason !== undefined
      ? { discountReason: data.discountReason || null }
      : {}),

    ...(data.material !== undefined ? { material: data.material || null } : {}),
    ...(data.fulfillmentType !== undefined
      ? {
          fulfillmentType: parseEnumValue(
            FulfillmentType,
            data.fulfillmentType,
            "fulfillmentType",
          ),
        }
      : {}),
    ...(data.cancellationReason !== undefined
      ? { cancellationReason: data.cancellationReason || null }
      : {}),
  };
}
