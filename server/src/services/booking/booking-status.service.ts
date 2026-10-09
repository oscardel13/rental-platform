import {
  BookingStatus,
  PaymentStatus,
  Prisma,
} from "../../generated/prisma/client.ts";

import { createServiceError } from "../../utils/error.utils.ts";

function parseStatus<T extends string>(
  enumObject: Record<string, T>,
  value: string | null | undefined,
  field: string,
): T | null {
  if (!value) return null;

  if ((Object.values(enumObject) as string[]).includes(value)) {
    return value as T;
  }

  throw createServiceError(`Invalid ${field}: ${value}.`, 400);
}

export function normalizeBookingStatusValue(value?: string | null) {
  return parseStatus(BookingStatus, value, "bookingStatus");
}

export function normalizePaymentStatusValue(value?: string | null) {
  return parseStatus(PaymentStatus, value, "paymentStatus");
}

export function buildBookingStatusUpdateData({
  bookingStatus,
  paymentStatus,
}: {
  bookingStatus?: string | null;
  paymentStatus?: string | null;
}): Prisma.BookingUpdateInput {
  const bookingStatusValue = normalizeBookingStatusValue(bookingStatus);
  const paymentStatusValue = normalizePaymentStatusValue(paymentStatus);

  if (!bookingStatusValue && !paymentStatusValue) {
    throw createServiceError(
      "At least one of bookingStatus or paymentStatus is required.",
      400,
    );
  }

  const now = new Date();

  return {
    ...(bookingStatusValue
      ? {
          bookingStatus: bookingStatusValue,

          ...(bookingStatusValue === BookingStatus.CONFIRMED
            ? { confirmedAt: now }
            : {}),
          ...(bookingStatusValue === BookingStatus.SCHEDULED
            ? { scheduledAt: now }
            : {}),
          ...(bookingStatusValue === BookingStatus.ACTIVE
            ? { deliveredAt: now }
            : {}),
          ...(bookingStatusValue === BookingStatus.COMPLETED
            ? {
                completedAt: now,
                pickedUpAt: now,
              }
            : {}),
          ...(bookingStatusValue === BookingStatus.CANCELLED
            ? { cancelledAt: now }
            : {}),
        }
      : {}),

    ...(paymentStatusValue
      ? {
          paymentStatus: paymentStatusValue,

          ...(paymentStatusValue === PaymentStatus.PAID ? { paidAt: now } : {}),
        }
      : {}),
  };
}
