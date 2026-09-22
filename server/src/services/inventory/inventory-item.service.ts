import {
  BookingStatus,
  InventoryCategory,
  InventoryStatus,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";
import { getQueryString } from "../../utils/query.utils.ts";
import {
  addUtcDays,
  parseDateOnly,
  startOfUtcDay,
} from "../../utils/date.utils.ts";

import {
  normalizeInventoryCreateData,
  normalizeInventoryItemForOldFrontend,
  normalizeInventoryItemsForOldFrontend,
  normalizeInventoryUpdateData,
} from "./inventory-normalizer.service.ts";

import { bookingOverlapsDateRange } from "./inventory-availability.service.ts";

export const getInventoryItems = async (tenantId: string, query: any) => {
  const status = getQueryString(query.status);
  const category = getQueryString(query.category);

  const items = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      isActive: true,
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

  return normalizeInventoryItemsForOldFrontend(items);
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

  return normalizeInventoryItemsForOldFrontend(availableItems);
};

export const getInventoryItemById = async (tenantId: string, id: string) => {
  const item = await prisma.inventoryItem.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  return item ? normalizeInventoryItemForOldFrontend(item) : null;
};

export const createInventoryItem = async (tenantId: string, data: any) => {
  if (!data.label) {
    throw createServiceError("Inventory item label is required.", 400);
  }

  const item = await prisma.inventoryItem.create({
    data: normalizeInventoryCreateData(tenantId, data),
  });

  return normalizeInventoryItemForOldFrontend(item);
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

  const item = await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: normalizeInventoryUpdateData(data),
  });

  return normalizeInventoryItemForOldFrontend(item);
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

  return normalizeInventoryItemForOldFrontend(item);
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

  return normalizeInventoryItemForOldFrontend(item);
};
