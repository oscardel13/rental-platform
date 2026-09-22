import {
  BookingStatus,
  PaymentStatus,
  Prisma,
} from "../../generated/prisma/client.ts";

import { getQueryString } from "../../utils/query.utils.ts";

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function buildAdminBookingWhere({
  tenantId,
  query,
}: {
  tenantId: string;
  query: any;
}): Prisma.BookingWhereInput {
  const bookingStatus = getQueryString(query.bookingStatus);
  const paymentStatus = getQueryString(query.paymentStatus);
  const customerEmail = getQueryString(query.customerEmail);
  const search = getQueryString(query.search);

  const fromDate = parseDate(query.fromDate);
  const toDate = parseDate(query.toDate);

  return {
    tenantId,

    ...(bookingStatus
      ? {
          bookingStatus: bookingStatus as BookingStatus,
        }
      : {}),

    ...(paymentStatus
      ? {
          paymentStatus: paymentStatus as PaymentStatus,
        }
      : {}),

    ...(customerEmail
      ? {
          customerEmail: customerEmail.trim().toLowerCase(),
        }
      : {}),

    ...(fromDate || toDate
      ? {
          deliveryDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              bookingNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              customerName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              customerEmail: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              customerPhone: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              address1: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
}
