import { prisma } from "../../libs/prisma.ts";

import { buildAdminBookingWhere } from "./booking-admin-query.service.ts";
import {
  ADMIN_PRICING_FIELDS,
  normalizeAdminBookingUpdateData,
} from "./booking-admin-update.service.ts";
import { checkInventoryAvailability } from "./booking-availability.service.ts";
import { recalculateBookingTotals } from "./booking-pricing.service.ts";
import { createServiceError } from "../../utils/error.utils.ts";
import { BookingStatus } from "../../generated/prisma/client.ts";
import { buildBookingStatusUpdateData } from "./booking-status.service.ts";
import { createAdminBookingHistory } from "./booking-history.service.ts";
import {
  closeBookingRequest,
  createAdminBookingNote,
  getBookingNoteCounts,
  getOpenRequestNoteOrThrow,
  markBookingNotesRead,
} from "./booking-notes.service.ts";
import {
  BookingNoteRequestStatus,
  BookingNoteType,
} from "../../generated/prisma/client.ts";
import {
  bookingDetailInclude,
  bookingListInclude,
  normalizeBookingDetail,
  normalizeBookingListItem,
} from "./booking-normalizer.service.ts";

type GetAdminBookingsInput = {
  tenantId: string;
  query: any;
  userId?: string | null;
};

type GetAdminBookingByIdInput = {
  tenantId: string;
  id: string;
  userId?: string | null;
};

type UpdateAdminBookingInput = {
  tenantId: string;
  id: string;
  data: any;
  actorLabel: string;
  userId?: string | null;
};

type UpdateAdminBookingStatusInput = {
  tenantId: string;
  id: string;
  bookingStatus?: string | null | undefined;
  paymentStatus?: string | null | undefined;
  cancellationReason?: string | null | undefined;
  actorLabel: string;
  userId?: string | null;
};

export { createAdminBookingNote };

export async function getAdminBookings({
  tenantId,
  query,
  userId = null,
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

  // Flags bookings with new notes or open customer requests for this user.
  const noteCounts = await getBookingNoteCounts({
    tenantId,
    bookingIds: bookings.map((booking) => booking.id),
    viewerUserId: userId,
    audience: "STAFF",
  });

  return bookings.map((booking) => ({
    ...normalizeBookingListItem(booking),
    unreadNoteCount: noteCounts.get(booking.id)?.unreadNoteCount ?? 0,
    openRequestCount: noteCounts.get(booking.id)?.openRequestCount ?? 0,
  }));
}

export async function getAdminBookingById({
  tenantId,
  id,
  userId = null,
}: GetAdminBookingByIdInput) {
  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id,
    },
    include: bookingDetailInclude,
  });

  return booking ? normalizeBookingDetail(booking, userId) : null;
}

export async function updateAdminBooking({
  tenantId,
  id,
  data,
  actorLabel,
  userId = null,
}: UpdateAdminBookingInput) {
  const existingBooking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id,
    },
    include: {
      inventoryItems: {
        where: { role: "PRIMARY" },
        take: 1,
      },
    },
  });

  if (!existingBooking) {
    return null;
  }

  const updateData = normalizeAdminBookingUpdateData(data);
  const updatedFields = Object.keys(data || {});

  // Turning priority delivery off removes its fee.
  if (data?.priorityDelivery === false && data.priorityDeliveryFee === undefined) {
    updateData.priorityDeliveryFee = 0;
  }

  if (
    updateData.bookingStatus === BookingStatus.CANCELLED &&
    existingBooking.bookingStatus !== BookingStatus.CANCELLED
  ) {
    updateData.cancelledAt = new Date();
  }

  // Check the resulting booking, not just the fields sent.
  const nextDeliveryDate =
    (updateData.deliveryDate as Date | undefined) ?? existingBooking.deliveryDate;
  const nextPickupDate =
    updateData.pickupDate !== undefined
      ? (updateData.pickupDate as Date | null)
      : existingBooking.pickupDate;
  const nextPickupUnknown =
    (updateData.pickupDateUnknown as boolean | undefined) ??
    existingBooking.pickupDateUnknown;

  if (nextPickupDate && nextPickupDate < nextDeliveryDate) {
    throw createServiceError(
      "Pickup date cannot be before delivery date.",
      400,
    );
  }

  const nextDiscount =
    data?.discountAmount !== undefined
      ? Number(data.discountAmount)
      : Number(existingBooking.discountAmount);
  const nextDiscountReason =
    data?.discountReason !== undefined
      ? data.discountReason
      : existingBooking.discountReason;

  if (nextDiscount > 0 && !nextDiscountReason) {
    throw createServiceError("Add a reason for the discount.", 400);
  }

  const datesChanged =
    updatedFields.includes("deliveryDate") ||
    updatedFields.includes("pickupDate") ||
    updatedFields.includes("pickupDateUnknown");

  const primaryItemId = existingBooking.inventoryItems[0]?.inventoryItemId;

  // Moving dates must not double-book the dumpster.
  if (datesChanged && primaryItemId) {
    await checkInventoryAvailability({
      tenantId,
      inventoryItemId: primaryItemId,
      deliveryDate: nextDeliveryDate,
      pickupDate: nextPickupDate,
      pickupDateUnknown: nextPickupUnknown,
      ignoreBookingId: existingBooking.id,
    });
  }

  const pricingChanged = updatedFields.some((field) =>
    ADMIN_PRICING_FIELDS.includes(field),
  );

  const updatedBooking = await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: {
        id,
      },
      data: updateData,
    });

    if (pricingChanged) {
      await recalculateBookingTotals(tx, id);
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id },
      include: bookingDetailInclude,
    });

    await createAdminBookingHistory({
      tx,
      tenantId,
      bookingId: id,
      actorLabel,
      eventType: "ADMIN_BOOKING_UPDATED",
      summary: pricingChanged
        ? "Admin updated booking details and the price was recalculated."
        : "Admin updated booking details.",
      metadata: {
        updatedFields,
        ...(pricingChanged
          ? {
              previousTotal: Number(existingBooking.total),
              nextTotal: Number(booking.total),
            }
          : {}),
      },
    });

    return booking;
  });

  return normalizeBookingDetail(updatedBooking, userId);
}

export async function updateAdminBookingStatus({
  tenantId,
  id,
  bookingStatus,
  paymentStatus,
  cancellationReason,
  actorLabel,
  userId = null,
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

  if (bookingStatus === BookingStatus.CANCELLED) {
    statusUpdateData.cancellationReason =
      String(cancellationReason || "").trim() || null;
  }

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
        ...(bookingStatus === BookingStatus.CANCELLED
          ? { cancellationReason: cancellationReason ?? null }
          : {}),
      },
    });

    return booking;
  });

  return normalizeBookingDetail(updatedBooking, userId);
}

// Called when staff open a booking: their unread notes become read.
export async function markAdminBookingNotesRead({
  tenantId,
  id,
  userId,
}: {
  tenantId: string;
  id: string;
  userId: string;
}) {
  const booking = await prisma.booking.findFirst({
    where: { tenantId, id },
    select: { id: true },
  });

  if (!booking) return null;

  const marked = await markBookingNotesRead({
    tenantId,
    bookingId: id,
    userId,
  });

  return { marked };
}

const REQUEST_ACTIONS = {
  APPROVE: BookingNoteRequestStatus.APPROVED,
  DECLINE: BookingNoteRequestStatus.DECLINED,
  RESOLVE: BookingNoteRequestStatus.RESOLVED,
} as const;

/**
 * Staff answer to a customer request.
 * - APPROVE (reschedule only): applies the requested dates through
 *   updateAdminBooking, so availability is checked and the price updated.
 * - DECLINE: tells the customer no (with an optional message).
 * - RESOLVE: handled another way, e.g. on the phone.
 */
export async function resolveAdminBookingRequest({
  tenantId,
  id,
  noteId,
  action,
  resolutionNote,
  actorLabel,
  userId = null,
}: {
  tenantId: string;
  id: string;
  noteId: string;
  action: unknown;
  resolutionNote?: string | null;
  actorLabel: string;
  userId?: string | null;
}) {
  const status =
    typeof action === "string"
      ? REQUEST_ACTIONS[action.toUpperCase() as keyof typeof REQUEST_ACTIONS]
      : undefined;

  if (!status) {
    throw createServiceError("action must be APPROVE, DECLINE or RESOLVE.", 400);
  }

  const note = await getOpenRequestNoteOrThrow({
    tenantId,
    bookingId: id,
    noteId,
  });

  if (status === BookingNoteRequestStatus.APPROVED) {
    if (note.type !== BookingNoteType.RESCHEDULE_REQUEST) {
      throw createServiceError(
        "Only reschedule requests can be approved here. Make the change, then mark it resolved.",
        400,
      );
    }

    // Throws (and leaves the request open) if the dumpster is taken.
    await updateAdminBooking({
      tenantId,
      id,
      actorLabel,
      userId,
      data: {
        deliveryDate: note.requestedDeliveryDate?.toISOString().slice(0, 10),
        pickupDate: note.requestedPickupDateUnknown
          ? null
          : note.requestedPickupDate?.toISOString().slice(0, 10) ?? null,
        pickupDateUnknown: Boolean(note.requestedPickupDateUnknown),
      },
    });
  }

  await prisma.$transaction((tx) =>
    closeBookingRequest({
      tx,
      tenantId,
      bookingId: id,
      noteId,
      status,
      resolutionNote: resolutionNote ?? null,
      userId,
      actorLabel,
    }),
  );

  return getAdminBookingById({ tenantId, id, userId });
}
