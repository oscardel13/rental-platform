import {
  BookingStatus,
  PaymentStatus,
  Prisma,
} from "../../generated/prisma/client.ts";

import { createServiceError } from "../../utils/error.utils.ts";

export function normalizeBookingStatusValue(value?: string | null) {
  return value ? (value as BookingStatus) : null;
}

export function normalizePaymentStatusValue(value?: string | null) {
  return value ? (value as PaymentStatus) : null;
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
