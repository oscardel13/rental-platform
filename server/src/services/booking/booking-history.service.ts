import { BookingActorType, Prisma } from "../../generated/prisma/client.ts";

export async function createAdminBookingHistory({
  tx,
  tenantId,
  bookingId,
  actorLabel,
  eventType,
  summary,
  metadata,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  bookingId: string;
  actorLabel: string;
  eventType: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return tx.bookingHistory.create({
    data: {
      tenantId,
      bookingId,
      eventType,
      actorType: BookingActorType.ADMIN,
      actorLabel,
      summary,
      metadata: metadata ?? Prisma.JsonNull,
    },
  });
}
