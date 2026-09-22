import { prisma } from "../../libs/prisma.ts";

import { buildAdminBookingWhere } from "./booking-admin-query.service.ts";
import { normalizeAdminBookingUpdateData } from "./booking-admin-update.service.ts";
import { buildBookingStatusUpdateData } from "./booking-status.service.ts";
import { createAdminBookingHistory } from "./booking-history.service.ts";
import { createAdminBookingNote } from "./booking-notes.service.ts";
import {
  bookingDetailInclude,
  bookingListInclude,
  normalizeBookingDetail,
  normalizeBookingListItem,
} from "./booking-normalizer.service.ts";

type GetAdminBookingsInput = {
  tenantId: string;
  query: any;
};

type GetAdminBookingByIdInput = {
  tenantId: string;
  id: string;
};

type UpdateAdminBookingInput = {
  tenantId: string;
  id: string;
  data: any;
  actorLabel: string;
};

type UpdateAdminBookingStatusInput = {
  tenantId: string;
  id: string;
  bookingStatus?: string | null | undefined;
  paymentStatus?: string | null | undefined;
  actorLabel: string;
};

export { createAdminBookingNote };

export async function getAdminBookings({
  tenantId,
  query,
}: GetAdminBookingsInput) {
  const bookings = await prisma.booking.findMany({
    where: buildAdminBookingWhere({
      tenantId,
      query,
    }),
    include: bookingListInclude,
    orderBy: [
      {
        deliveryDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return bookings.map(normalizeBookingListItem);
}

export async function getAdminBookingById({
  tenantId,
  id,
}: GetAdminBookingByIdInput) {
  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id,
    },
    include: bookingDetailInclude,
  });

  return booking ? normalizeBookingDetail(booking) : null;
}

export async function updateAdminBooking({
  tenantId,
  id,
  data,
  actorLabel,
}: UpdateAdminBookingInput) {
  const existingBooking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingBooking) {
    return null;
  }

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.update({
      where: {
        id,
      },
      data: normalizeAdminBookingUpdateData(data),
      include: bookingDetailInclude,
    });

    await createAdminBookingHistory({
      tx,
      tenantId,
      bookingId: id,
      actorLabel,
      eventType: "ADMIN_BOOKING_UPDATED",
      summary: "Admin updated booking details.",
      metadata: {
        updatedFields: Object.keys(data || {}),
      },
    });

    return booking;
  });

  return normalizeBookingDetail(updatedBooking);
}

export async function updateAdminBookingStatus({
  tenantId,
  id,
  bookingStatus,
  paymentStatus,
  actorLabel,
}: UpdateAdminBookingStatusInput) {
  const existingBooking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingBooking) {
    return null;
  }

  const statusUpdateData = buildBookingStatusUpdateData({
    ...(bookingStatus !== undefined ? { bookingStatus } : {}),
    ...(paymentStatus !== undefined ? { paymentStatus } : {}),
  });

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.update({
      where: {
        id,
      },
      data: statusUpdateData,
      include: bookingDetailInclude,
    });

    await createAdminBookingHistory({
      tx,
      tenantId,
      bookingId: id,
      actorLabel,
      eventType: "ADMIN_BOOKING_STATUS_UPDATED",
      summary: "Admin updated booking status.",
      metadata: {
        previousBookingStatus: existingBooking.bookingStatus,
        nextBookingStatus: bookingStatus ?? null,
        previousPaymentStatus: existingBooking.paymentStatus,
        nextPaymentStatus: paymentStatus ?? null,
      },
    });

    return booking;
  });

  return normalizeBookingDetail(updatedBooking);
}
