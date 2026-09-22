import {
  BookingActorType,
  NoteVisibility,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";

export async function createAdminBookingNote({
  tenantId,
  bookingId,
  body,
  actorLabel,
}: {
  tenantId: string;
  bookingId: string;
  body?: string | null;
  actorLabel: string;
}) {
  const normalizedBody = String(body || "").trim();

  if (!normalizedBody) {
    throw createServiceError("Note body is required.", 400);
  }

  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      id: bookingId,
    },
  });

  if (!booking) {
    throw createServiceError("Booking not found.", 404);
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await tx.bookingNote.create({
      data: {
        tenantId,
        bookingId,
        visibility: NoteVisibility.INTERNAL,
        body: normalizedBody,
      },
    });

    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId,
        eventType: "ADMIN_NOTE_CREATED",
        actorType: BookingActorType.ADMIN,
        actorLabel,
        summary: "Admin added an internal note.",
        metadata: {
          noteId: createdNote.id,
        },
      },
    });

    return createdNote;
  });

  return note;
}
