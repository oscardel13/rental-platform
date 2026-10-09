import {
  BookingStatus,
  InventoryCategory,
  InventoryStatus,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";
import { getQueryBoolean, getQueryString } from "../../utils/query.utils.ts";
import {
  addUtcDays,
  parseDateOnly,
  startOfUtcDay,
} from "../../utils/date.utils.ts";

import {
  normalizeInventoryCreateData,
  normalizeInventoryItemResponse,
  normalizeInventoryItemsResponse,
  normalizeInventoryUpdateData,
  resolveColorCombo,
} from "./inventory-normalizer.service.ts";

import { bookingOverlapsDateRange } from "./inventory-availability.service.ts";

// Serial numbers are unique per tenant (@@unique([tenantId, serialNumber])).
function rethrowDuplicateSerialNumber(error: unknown): never {
  if ((error as { code?: string } | null)?.code === "P2002") {
    throw createServiceError(
      "Another inventory item already uses this serial number.",
      409,
    );
  }

  throw error;
}

// ?includeInactive=true is for the admin inventory page, so items marked
// inactive can still be found and reactivated.
export const getInventoryItems = async (tenantId: string, query: any) => {
  const status = getQueryString(query.status);
  const category = getQueryString(query.category);
  const includeInactive = getQueryBoolean(query.includeInactive);

  const items = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(status ? { status: status as InventoryStatus } : {}),
      ...(category ? { category: category as InventoryCategory } : {}),
    },
    orderBy: [
      {
        sizeValue: "asc",
      },
      {
        label: "asc",
      },
    ],
  });

  return normalizeInventoryItemsResponse(items);
};

export const getInventoryItemsFilteredByDates = async (
  tenantId: string,
  query: any,
) => {
  const deliveryDate =
    parseDateOnly(getQueryString(query.deliveryDate)) ??
    startOfUtcDay(new Date());

  const pickupDate =
    parseDateOnly(getQueryString(query.pickupDate)) ??
    addUtcDays(deliveryDate, 14);

  const requestedEndExclusive = addUtcDays(pickupDate, 1);

  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      isActive: true,
      status: {
        notIn: [InventoryStatus.MAINTENANCE, InventoryStatus.OUT_OF_SERVICE],
      },
    },
    include: {
      bookingItems: {
        where: {
          booking: {
            bookingStatus: {
              in: [
                BookingStatus.SCHEDULED,
                BookingStatus.CONFIRMED,
                BookingStatus.ACTIVE,
              ],
            },
            deliveryDate: {
              lt: requestedEndExclusive,
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
            ],
          },
        },
        include: {
          booking: {
            select: {
              id: true,
              deliveryDate: true,
              pickupDate: true,
              pickupDateUnknown: true,
              bookingStatus: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        sizeValue: "asc",
      },
      {
        label: "asc",
      },
    ],
  });

  const availableItems = inventoryItems.filter((item) => {
    return !item.bookingItems.some((bookingItem) => {
      return bookingOverlapsDateRange({
        booking: bookingItem.booking,
        rangeStart: deliveryDate,
        rangeEndExclusive: requestedEndExclusive,
      });
    });
  });

  return normalizeInventoryItemsResponse(availableItems);
};

export const getInventoryItemById = async (tenantId: string, id: string) => {
  const item = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  return item ? normalizeInventoryItemResponse(item) : null;
};

export const createInventoryItem = async (tenantId: string, data: any) => {
  const item = await prisma.inventoryItem
    .create({
      data: normalizeInventoryCreateData(tenantId, data ?? {}),
    })
    .catch(rethrowDuplicateSerialNumber);

  return normalizeInventoryItemResponse(item);
};

export const updateInventoryItem = async (
  tenantId: string,
  id: string,
  data: any,
) => {
  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingItem) {
    return null;
  }

  const updateData = normalizeInventoryUpdateData(data ?? {});

  // Re-check the color combination against the item's current colors.
  if (
    "primaryColor" in updateData ||
    "secondaryColor" in updateData ||
    "colorPattern" in updateData
  ) {
    Object.assign(
      updateData,
      resolveColorCombo({
        primaryColor: updateData.primaryColor ?? existingItem.primaryColor,
        secondaryColor:
          "secondaryColor" in updateData
            ? (updateData.secondaryColor ?? null)
            : existingItem.secondaryColor,
        colorPattern: updateData.colorPattern ?? existingItem.colorPattern,
      }),
    );
  }

  const item = await prisma.inventoryItem
    .update({
      where: {
        id,
      },
      data: updateData,
    })
    .catch(rethrowDuplicateSerialNumber);

  return normalizeInventoryItemResponse(item);
};

export const deleteInventoryItem = async (tenantId: string, id: string) => {
  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingItem) {
    return false;
  }

  await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return true;
};

export const lockInventoryItem = async (tenantId: string, id: string) => {
  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingItem) {
    return null;
  }

  const item = await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: {
      status: InventoryStatus.RESERVED,
    },
  });

  return normalizeInventoryItemResponse(item);
};

export const unlockInventoryItem = async (tenantId: string, id: string) => {
  const existingItem = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingItem) {
    return null;
  }

  const item = await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: {
      status: InventoryStatus.AVAILABLE,
    },
  });

  return normalizeInventoryItemResponse(item);
};
