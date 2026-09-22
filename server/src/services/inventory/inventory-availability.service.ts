import {
  BookingStatus,
  InventoryStatus,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import {
  addUtcDays,
  formatDateOnly,
  parseDateOnly,
  startOfUtcDay,
} from "../../utils/date.utils.ts";
import { getQueryNumber, getQueryString } from "../../utils/query.utils.ts";

export function bookingOverlapsDateRange({
  booking,
  rangeStart,
  rangeEndExclusive,
}: {
  booking: {
    deliveryDate: Date;
    pickupDate: Date | null;
    pickupDateUnknown: boolean;
  };
  rangeStart: Date;
  rangeEndExclusive: Date;
}) {
  const bookingStart = startOfUtcDay(new Date(booking.deliveryDate));

  // Pickup day is blocked too, so make booking end exclusive the day after pickup.
  const bookingEndExclusive = booking.pickupDateUnknown
    ? addUtcDays(rangeEndExclusive, 365)
    : booking.pickupDate
      ? addUtcDays(startOfUtcDay(new Date(booking.pickupDate)), 1)
      : addUtcDays(bookingStart, 15);

  return bookingStart < rangeEndExclusive && rangeStart < bookingEndExclusive;
}

function getMaxRentalDaysForItem({
  date,
  bookingItems,
  fallbackMaxDays = 14,
}: {
  date: Date;
  bookingItems: Array<{
    booking: {
      deliveryDate: Date;
      pickupDate: Date | null;
      pickupDateUnknown: boolean;
    };
  }>;
  fallbackMaxDays?: number;
}) {
  const blockedOnStartDate = bookingItems.some((bookingItem) => {
    return bookingOverlapsDateRange({
      booking: bookingItem.booking,
      rangeStart: date,
      rangeEndExclusive: addUtcDays(date, 1),
    });
  });

  if (blockedOnStartDate) {
    return 0;
  }

  let maxRentalDays = fallbackMaxDays;

  for (const bookingItem of bookingItems) {
    const booking = bookingItem.booking;
    const bookingStart = startOfUtcDay(new Date(booking.deliveryDate));

    if (bookingStart > date) {
      const diffMs = bookingStart.getTime() - date.getTime();
      const daysUntilNextBooking = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Next booking's delivery day cannot also be this booking's pickup day.
      const allowedRentalDaysBeforeNextBooking = Math.max(
        0,
        daysUntilNextBooking - 1,
      );

      maxRentalDays = Math.min(
        maxRentalDays,
        allowedRentalDaysBeforeNextBooking,
      );
    }
  }

  return maxRentalDays;
}

function getAvailabilityStatus(startableCount: number, maxRentalDays: number) {
  if (startableCount <= 0) return "UNAVAILABLE";
  if (maxRentalDays >= 7) return "AVAILABLE_7_PLUS";
  return "LIMITED";
}

export async function getPublicInventoryAvailabilitySummary(
  tenantId: string,
  query: any,
) {
  const startDate =
    parseDateOnly(getQueryString(query.startDate)) ??
    parseDateOnly(getQueryString(query.deliveryDate)) ??
    startOfUtcDay(new Date());

  const days = Math.max(1, Math.min(getQueryNumber(query.days, 21), 60));

  // rentalDays behavior:
  // missing / empty / 0 = only check whether an item can start that day
  // rentalDays=1       = count items that can support at least 1 rental day
  // rentalDays=7       = count items that can support at least 7 rental days
  const requestedRentalDays = Math.max(
    0,
    Math.min(getQueryNumber(query.rentalDays, 0), 30),
  );

  const fallbackMaxRentalDays = Math.max(
    1,
    Math.min(getQueryNumber(query.maxRentalDays, 14), 60),
  );

  const endDate = addUtcDays(startDate, days + fallbackMaxRentalDays + 1);

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
              lt: endDate,
            },
            OR: [
              {
                pickupDate: {
                  gte: startDate,
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
              bookingNumber: true,
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

  const calendarDays = Array.from({ length: days }, (_, index) => {
    const date = addUtcDays(startDate, index);

    const itemAvailability = inventoryItems.map((item) => {
      const maxRentalDays = getMaxRentalDaysForItem({
        date,
        bookingItems: item.bookingItems,
        fallbackMaxDays: fallbackMaxRentalDays,
      });

      return {
        itemId: item.id,
        label: item.label,
        maxRentalDays,
        canStart: maxRentalDays > 0,
        canMeetRequestedRentalDays:
          requestedRentalDays <= 0
            ? maxRentalDays > 0
            : maxRentalDays >= requestedRentalDays,
        canDoSevenDays: maxRentalDays >= 7,
      };
    });

    const startableItems = itemAvailability.filter((entry) => entry.canStart);

    const availableItems = itemAvailability.filter(
      (entry) => entry.canMeetRequestedRentalDays,
    );

    const sevenDayItems = itemAvailability.filter(
      (entry) => entry.canDoSevenDays,
    );

    const maxRentalDays =
      itemAvailability.length > 0
        ? Math.max(...itemAvailability.map((entry) => entry.maxRentalDays))
        : 0;

    const defaultRentalDays = maxRentalDays >= 7 ? 7 : maxRentalDays;

    return {
      date: formatDateOnly(date),

      availableCount: availableItems.length,
      startableCount: startableItems.length,
      sevenDayAvailableCount: sevenDayItems.length,

      totalCount: inventoryItems.length,
      maxRentalDays,
      defaultRentalDays,

      hasSevenDayAvailability: sevenDayItems.length > 0,

      status: getAvailabilityStatus(startableItems.length, maxRentalDays),

      availableItemIds: availableItems.map((entry) => entry.itemId),
      startableItemIds: startableItems.map((entry) => entry.itemId),
      sevenDayAvailableItemIds: sevenDayItems.map((entry) => entry.itemId),
    };
  });

  return {
    totalInventoryItems: inventoryItems.length,
    totalAvailableItems: calendarDays[0]?.availableCount ?? 0,
    startDate: formatDateOnly(startDate),
    requestedRentalDays,
    maxRentalDaysLimit: fallbackMaxRentalDays,
    days: calendarDays,
  };
}
