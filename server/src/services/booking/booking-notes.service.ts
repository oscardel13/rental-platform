import {
  BookingActorType,
  BookingNoteRequestStatus,
  BookingNoteType,
  BookingStatus,
  NoteVisibility,
  Prisma,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { parseDateOnly } from "../../utils/date.utils.ts";
import { createServiceError } from "../../utils/error.utils.ts";

import { checkInventoryAvailability } from "./booking-availability.service.ts";
import { computeBookingTotals } from "./booking-pricing.service.ts";

/**
 * Booking notes double as the message thread between staff and customers:
 * plain notes, change requests and reschedule requests. Every note keeps
 * read receipts (BookingNoteView) so the dashboards can flag new activity.
 */

type Db = Prisma.TransactionClient | typeof prisma;

const userSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export const bookingNoteInclude = {
  authorUser: { select: userSummarySelect },
  resolvedBy: { select: userSummarySelect },
  views: {
    include: { user: { select: userSummarySelect } },
    orderBy: { viewedAt: "asc" },
  },
} satisfies Prisma.BookingNoteInclude;

// Bookings that are over can't be rescheduled.
const CLOSED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
];

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 5000;

function getUserLabel(user?: { name?: string | null; email?: string | null } | null) {
  return user?.name || user?.email || null;
}

function toDateOnlyString(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : "";
}

/**
 * Shape sent to dashboards. `isUnread` is from the viewer's point of view:
 * written by someone else and not opened by them yet.
 */
export function normalizeBookingNote(note: any, viewerUserId?: string | null) {
  const views = (note.views ?? []).map((view: any) => ({
    userId: view.userId,
    name: getUserLabel(view.user) ?? "Unknown user",
    viewedAt: view.viewedAt,
  }));

  const isMine = Boolean(viewerUserId && note.authorUserId === viewerUserId);

  return {
    id: note.id,
    bookingId: note.bookingId,
    type: note.type,
    title: note.title,
    body: note.body,
    visibility: note.visibility,

    authorType: note.authorType,
    authorUserId: note.authorUserId,
    authorLabel:
      getUserLabel(note.authorUser) ||
      note.authorLabel ||
      (note.authorType === BookingActorType.CLIENT ? "Customer" : "Staff"),
    isMine,

    requestStatus: note.requestStatus,
    requestedDeliveryDate: toDateOnlyString(note.requestedDeliveryDate),
    requestedPickupDate: toDateOnlyString(note.requestedPickupDate),
    requestedPickupDateUnknown: note.requestedPickupDateUnknown,
    resolvedAt: note.resolvedAt,
    resolvedByLabel: getUserLabel(note.resolvedBy),
    resolutionNote: note.resolutionNote,

    views,
    isUnread:
      Boolean(viewerUserId) &&
      !isMine &&
      !views.some((view: any) => view.userId === viewerUserId),

    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

/**
 * Per-booking attention counts for list views.
 * - staff: unread notes written by anyone else, plus open requests.
 * - customer: unread staff replies visible to them.
 */
export async function getBookingNoteCounts({
  tenantId,
  bookingIds,
  viewerUserId,
  audience,
}: {
  tenantId: string;
  bookingIds: string[];
  viewerUserId: string | null;
  audience: "STAFF" | "CUSTOMER";
}) {
  const counts = new Map<
    string,
    { unreadNoteCount: number; openRequestCount: number }
  >();

  if (bookingIds.length === 0) return counts;

  const ensure = (bookingId: string) => {
    if (!counts.has(bookingId)) {
      counts.set(bookingId, { unreadNoteCount: 0, openRequestCount: 0 });
    }
    return counts.get(bookingId)!;
  };

  if (viewerUserId) {
    const unread = await prisma.bookingNote.groupBy({
      by: ["bookingId"],
      where: {
        tenantId,
        bookingId: { in: bookingIds },
        // NULL authors (system/old notes) count as someone else.
        OR: [{ authorUserId: null }, { authorUserId: { not: viewerUserId } }],
        views: { none: { userId: viewerUserId } },
        ...(audience === "CUSTOMER"
          ? {
              visibility: NoteVisibility.CUSTOMER,
              authorType: { not: BookingActorType.CLIENT },
            }
          : {}),
      },
      _count: { _all: true },
    });

    for (const row of unread) {
      ensure(row.bookingId).unreadNoteCount = row._count._all;
    }
  }

  if (audience === "STAFF") {
    const open = await prisma.bookingNote.groupBy({
      by: ["bookingId"],
      where: {
        tenantId,
        bookingId: { in: bookingIds },
        requestStatus: BookingNoteRequestStatus.OPEN,
      },
      _count: { _all: true },
    });

    for (const row of open) {
      ensure(row.bookingId).openRequestCount = row._count._all;
    }
  }

  return counts;
}

// Records that the viewer opened every note on the booking they can see.
export async function markBookingNotesRead({
  tenantId,
  bookingId,
  userId,
  customerOnly = false,
}: {
  tenantId: string;
  bookingId: string;
  userId: string;
  customerOnly?: boolean;
}) {
  const notes = await prisma.bookingNote.findMany({
    where: {
      tenantId,
      bookingId,
      ...(customerOnly ? { visibility: NoteVisibility.CUSTOMER } : {}),
      views: { none: { userId } },
    },
    select: { id: true },
  });

  if (notes.length === 0) return 0;

  const result = await prisma.bookingNoteView.createMany({
    data: notes.map((note) => ({ tenantId, noteId: note.id, userId })),
    skipDuplicates: true,
  });

  return result.count;
}

async function createNoteWithAuthorView(
  db: Db,
  data: Prisma.BookingNoteUncheckedCreateInput,
) {
  const note = await db.bookingNote.create({ data });

  // The author has obviously seen their own note.
  if (data.authorUserId) {
    await db.bookingNoteView.create({
      data: {
        tenantId: data.tenantId,
        noteId: note.id,
        userId: data.authorUserId,
      },
    });
  }

  return db.bookingNote.findUniqueOrThrow({
    where: { id: note.id },
    include: bookingNoteInclude,
  });
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                       */
/* -------------------------------------------------------------------------- */

export async function createAdminBookingNote({
  tenantId,
  bookingId,
  title,
  body,
  visibility,
  actorLabel,
  userId,
}: {
  tenantId: string;
  bookingId: string;
  title?: string | null;
  body?: string | null;
  visibility?: string | null;
  actorLabel: string;
  userId?: string | null;
}) {
  const normalizedBody = cleanText(body, MAX_BODY_LENGTH);

  if (!normalizedBody) {
    throw createServiceError("Note body is required.", 400);
  }

  // INTERNAL = team only; CUSTOMER = a reply the customer can read.
  const normalizedVisibility =
    visibility === NoteVisibility.CUSTOMER
      ? NoteVisibility.CUSTOMER
      : NoteVisibility.INTERNAL;

  const booking = await prisma.booking.findFirst({
    where: { tenantId, id: bookingId },
    select: { id: true },
  });

  if (!booking) {
    throw createServiceError("Booking not found.", 404);
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await createNoteWithAuthorView(tx, {
      tenantId,
      bookingId,
      type: BookingNoteType.NOTE,
      visibility: normalizedVisibility,
      title: cleanText(title, MAX_TITLE_LENGTH) || null,
      body: normalizedBody,
      authorType: BookingActorType.ADMIN,
      authorUserId: userId ?? null,
      authorLabel: actorLabel,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId,
        eventType:
          normalizedVisibility === NoteVisibility.CUSTOMER
            ? "ADMIN_CUSTOMER_REPLY_CREATED"
            : "ADMIN_NOTE_CREATED",
        actorType: BookingActorType.ADMIN,
        actorLabel,
        summary:
          normalizedVisibility === NoteVisibility.CUSTOMER
            ? "Admin replied to the customer."
            : "Admin added an internal note.",
        metadata: { noteId: createdNote.id },
      },
    });

    return createdNote;
  });

  return normalizeBookingNote(note, userId);
}

/**
 * Closes a customer request. Approving a reschedule (applying the dates) is
 * done by the caller first; this only records the outcome, and, when there
 * is a message, posts it as a reply the customer can read.
 */
export async function closeBookingRequest({
  tx,
  tenantId,
  bookingId,
  noteId,
  status,
  resolutionNote,
  userId,
  actorLabel,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  bookingId: string;
  noteId: string;
  status: BookingNoteRequestStatus;
  resolutionNote?: string | null;
  userId: string | null;
  actorLabel: string;
}) {
  const message = cleanText(resolutionNote, MAX_BODY_LENGTH) || null;

  const note = await tx.bookingNote.update({
    where: { id: noteId },
    data: {
      requestStatus: status,
      resolvedAt: new Date(),
      resolvedByUserId: userId,
      resolutionNote: message,
    },
  });

  const outcome =
    status === BookingNoteRequestStatus.APPROVED
      ? "approved"
      : status === BookingNoteRequestStatus.DECLINED
        ? "declined"
        : "resolved";

  // Internal alerts (e.g. double booking) never message the customer.
  const isCustomerRequest = note.visibility === NoteVisibility.CUSTOMER;

  if (
    isCustomerRequest &&
    (message || status !== BookingNoteRequestStatus.RESOLVED)
  ) {
    await createNoteWithAuthorView(tx, {
      tenantId,
      bookingId,
      type: BookingNoteType.NOTE,
      visibility: NoteVisibility.CUSTOMER,
      title: `Your ${
        note.type === BookingNoteType.RESCHEDULE_REQUEST
          ? "reschedule"
          : "change"
      } request was ${outcome}`,
      body: message || `We ${outcome} your request.`,
      authorType: BookingActorType.ADMIN,
      authorUserId: userId,
      authorLabel: actorLabel,
    });
  }

  await tx.bookingHistory.create({
    data: {
      tenantId,
      bookingId,
      eventType: `REQUEST_${status}`,
      actorType: BookingActorType.ADMIN,
      actorLabel,
      summary: `Admin ${outcome} a customer request.`,
      metadata: { noteId, resolutionNote: message },
    },
  });

  return note;
}

export async function getOpenRequestNoteOrThrow({
  tenantId,
  bookingId,
  noteId,
}: {
  tenantId: string;
  bookingId: string;
  noteId: string;
}) {
  const note = await prisma.bookingNote.findFirst({
    where: { id: noteId, tenantId, bookingId },
  });

  if (!note || note.type === BookingNoteType.NOTE) {
    throw createServiceError("Request not found.", 404);
  }

  if (note.requestStatus !== BookingNoteRequestStatus.OPEN) {
    throw createServiceError("This request was already handled.", 409);
  }

  return note;
}

/* -------------------------------------------------------------------------- */
/* Customer                                                                    */
/* -------------------------------------------------------------------------- */

type CustomerAuthor = {
  tenantId: string;
  bookingId: string;
  userId: string | null;
  actorLabel: string;
};

export async function createCustomerBookingNote({
  tenantId,
  bookingId,
  userId,
  actorLabel,
  title,
  body,
}: CustomerAuthor & { title?: unknown; body?: unknown }) {
  const normalizedBody = cleanText(body, MAX_BODY_LENGTH);

  if (!normalizedBody) {
    throw createServiceError("Note body is required.", 400);
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await createNoteWithAuthorView(tx, {
      tenantId,
      bookingId,
      type: BookingNoteType.NOTE,
      visibility: NoteVisibility.CUSTOMER,
      title: cleanText(title, MAX_TITLE_LENGTH) || null,
      body: normalizedBody,
      authorType: BookingActorType.CLIENT,
      authorUserId: userId,
      authorLabel: actorLabel,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId,
        eventType: "CLIENT_NOTE_CREATED",
        actorType: BookingActorType.CLIENT,
        actorLabel,
        summary: "Client added a note.",
        metadata: { noteId: createdNote.id },
      },
    });

    return createdNote;
  });

  return normalizeBookingNote(note, userId);
}

export async function createCustomerChangeRequest({
  tenantId,
  bookingId,
  userId,
  actorLabel,
  type,
  message,
}: CustomerAuthor & { type?: unknown; message?: unknown }) {
  const normalizedMessage = cleanText(message, MAX_BODY_LENGTH);

  if (!normalizedMessage) {
    throw createServiceError("Change request message is required.", 400);
  }

  const requestType = cleanText(type, 40).toUpperCase() || "GENERAL";
  const label = requestType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await createNoteWithAuthorView(tx, {
      tenantId,
      bookingId,
      type: BookingNoteType.CHANGE_REQUEST,
      visibility: NoteVisibility.CUSTOMER,
      title: `Change request: ${label}`,
      body: normalizedMessage,
      authorType: BookingActorType.CLIENT,
      authorUserId: userId,
      authorLabel: actorLabel,
      requestStatus: BookingNoteRequestStatus.OPEN,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId,
        eventType: "CLIENT_CHANGE_REQUESTED",
        actorType: BookingActorType.CLIENT,
        actorLabel,
        summary: `Client requested a booking change: ${label}.`,
        metadata: { noteId: createdNote.id, type: requestType },
      },
    });

    return createdNote;
  });

  return normalizeBookingNote(note, userId);
}

type RescheduleInput = {
  deliveryDate?: unknown;
  pickupDate?: unknown;
  pickupDateUnknown?: unknown;
};

/**
 * Checks proposed new dates for a booking: valid, not in the past, the same
 * dumpster is free, and what the booking would cost on those dates.
 */
export async function previewBookingReschedule({
  tenantId,
  bookingId,
  input,
}: {
  tenantId: string;
  bookingId: string;
  input: RescheduleInput;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      addons: true,
      inventoryItems: { where: { role: "PRIMARY" }, take: 1 },
    },
  });

  if (!booking) {
    throw createServiceError("Booking not found.", 404);
  }

  if (CLOSED_BOOKING_STATUSES.includes(booking.bookingStatus)) {
    throw createServiceError("This booking can no longer be rescheduled.", 400);
  }

  const deliveryDate = parseDateOnly(input.deliveryDate);

  if (!deliveryDate) {
    throw createServiceError("Choose a new delivery date.", 400);
  }

  const pickupDateUnknown = Boolean(input.pickupDateUnknown);
  const pickupDate = pickupDateUnknown ? null : parseDateOnly(input.pickupDate);

  if (!pickupDateUnknown && !pickupDate) {
    throw createServiceError("Choose a new pickup date.", 400);
  }

  if (pickupDate && pickupDate < deliveryDate) {
    throw createServiceError("Pickup date cannot be before delivery date.", 400);
  }

  const today = parseDateOnly(new Date().toISOString().slice(0, 10))!;

  if (deliveryDate < today) {
    throw createServiceError("Delivery date cannot be in the past.", 400);
  }

  const inventoryItemId = booking.inventoryItems[0]?.inventoryItemId ?? null;
  let available = true;
  let unavailableReason: string | null = null;

  if (inventoryItemId) {
    try {
      await checkInventoryAvailability({
        tenantId,
        inventoryItemId,
        deliveryDate,
        pickupDate,
        pickupDateUnknown,
        ignoreBookingId: booking.id,
      });
    } catch (error: any) {
      available = false;
      unavailableReason =
        error?.message || "Your dumpster is booked for those dates.";
    }
  }

  const currentTotal = Number(booking.total);
  const totals = computeBookingTotals({
    ...booking,
    deliveryDate,
    pickupDate,
  });

  return {
    available,
    unavailableReason,
    deliveryDate: toDateOnlyString(deliveryDate),
    pickupDate: toDateOnlyString(pickupDate),
    pickupDateUnknown,
    rentalDays: totals.rentalDays,
    extraDays: totals.extraDays,
    extraDaysFee: totals.extraDaysFee,
    currentTotal,
    newTotal: totals.total,
    difference: Math.round((totals.total - currentTotal) * 100) / 100,
  };
}

export async function createCustomerRescheduleRequest({
  tenantId,
  bookingId,
  userId,
  actorLabel,
  input,
  message,
}: CustomerAuthor & { input: RescheduleInput; message?: unknown }) {
  const preview = await previewBookingReschedule({ tenantId, bookingId, input });

  if (!preview.available) {
    throw createServiceError(
      `${preview.unavailableReason ?? "Those dates aren't available."} Pick other dates or send us a message.`,
      409,
    );
  }

  const existingOpen = await prisma.bookingNote.findFirst({
    where: {
      tenantId,
      bookingId,
      type: BookingNoteType.RESCHEDULE_REQUEST,
      requestStatus: BookingNoteRequestStatus.OPEN,
    },
    select: { id: true },
  });

  if (existingOpen) {
    throw createServiceError(
      "You already have a reschedule request waiting. We'll get back to you soon.",
      409,
    );
  }

  const datesText = `Delivery ${preview.deliveryDate} → Pickup ${
    preview.pickupDateUnknown ? "TBD" : preview.pickupDate
  }`;

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await createNoteWithAuthorView(tx, {
      tenantId,
      bookingId,
      type: BookingNoteType.RESCHEDULE_REQUEST,
      visibility: NoteVisibility.CUSTOMER,
      title: "Reschedule request",
      body: cleanText(message, MAX_BODY_LENGTH) || datesText,
      authorType: BookingActorType.CLIENT,
      authorUserId: userId,
      authorLabel: actorLabel,
      requestStatus: BookingNoteRequestStatus.OPEN,
      requestedDeliveryDate: parseDateOnly(preview.deliveryDate),
      requestedPickupDate: preview.pickupDate
        ? parseDateOnly(preview.pickupDate)
        : null,
      requestedPickupDateUnknown: preview.pickupDateUnknown,
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId,
        eventType: "CLIENT_RESCHEDULE_REQUESTED",
        actorType: BookingActorType.CLIENT,
        actorLabel,
        summary: `Client requested new dates: ${datesText}.`,
        metadata: {
          noteId: createdNote.id,
          requestedDeliveryDate: preview.deliveryDate,
          requestedPickupDate: preview.pickupDate,
          requestedPickupDateUnknown: preview.pickupDateUnknown,
          estimatedNewTotal: preview.newTotal,
        },
      },
    });

    return createdNote;
  });

  return { note: normalizeBookingNote(note, userId), preview };
}
