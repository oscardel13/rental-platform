import {
  BookingStatus,
  InventoryStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../libs/prisma.js";

import { createServiceError } from "../../utils/error.utils.ts";
import { addUtcDays } from "../../utils/date.utils.ts";

export async function findInventoryItemOrThrow({
  tenantId,
  inventoryItemId,
}: {
  tenantId: string;
  inventoryItemId: string;
}) {
  const inventoryItem = await prisma.inventoryItem.findFirst({
    where: {
      id: inventoryItemId,
      tenantId,
      isActive: true,
      status: {
        notIn: [InventoryStatus.MAINTENANCE, InventoryStatus.OUT_OF_SERVICE],
      },
    },
  });

  if (!inventoryItem) {
    throw createServiceError("Selected inventory item is not available.", 404);
  }

  return inventoryItem;
}

export async function checkInventoryAvailability({
  tenantId,
  inventoryItemId,
  deliveryDate,
  pickupDate,
  pickupDateUnknown,
  ignoreBookingId,
}: {
  tenantId: string;
  inventoryItemId: string;
  deliveryDate: Date;
  pickupDate: Date | null;
  pickupDateUnknown: boolean;
  ignoreBookingId?: string;
}) {
  const effectivePickupDate = pickupDate ?? addUtcDays(deliveryDate, 14);

  const conflictingBookingItem = await prisma.bookingInventoryItem.findFirst({
    where: {
      tenantId,
      inventoryItemId,
      ...(ignoreBookingId
        ? {
            bookingId: {
              not: ignoreBookingId,
            },
          }
        : {}),
      booking: {
        bookingStatus: {
          in: [
            BookingStatus.SCHEDULED,
            BookingStatus.CONFIRMED,
            BookingStatus.ACTIVE,
          ],
        },
        deliveryDate: {
          lt: effectivePickupDate,
        },
        OR: [
          {
            pickupDate: {
              gte: deliveryDate,
            },
          },
          {
            pickupDateUnknown: true,
          },
          ...(pickupDateUnknown
            ? [
                {
                  deliveryDate: {
                    gte: deliveryDate,
                  },
                },
              ]
            : []),
        ],
      },
    },
  });

  if (conflictingBookingItem) {
    throw createServiceError(
      "Selected inventory item is no longer available for those dates.",
      409,
    );
  }

  return true;
}
