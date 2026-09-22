// cron/status.cron.ts
import cron from "node-cron";
import { BookingStatus, InventoryStatus } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

async function updateBookingStatuses() {
  console.log("Updating booking statuses...", new Date().toISOString());

  const today = startOfDay(new Date());
  const now = new Date();

  try {
    await prisma.booking.updateMany({
      where: {
        bookingStatus: {
          in: [BookingStatus.SCHEDULED, BookingStatus.CONFIRMED],
        },
        deliveryDate: {
          lte: today,
        },
      },
      data: {
        bookingStatus: BookingStatus.ACTIVE,
        deliveredAt: now,
      },
    });

    await prisma.booking.updateMany({
      where: {
        bookingStatus: BookingStatus.ACTIVE,
        pickupDateUnknown: false,
        pickupDate: {
          lt: today,
        },
      },
      data: {
        bookingStatus: BookingStatus.COMPLETED,
        completedAt: now,
        pickedUpAt: now,
      },
    });

    console.log("Booking status update complete.");
  } catch (error) {
    console.error("Failed to update booking statuses:", error);
  }
}

async function updateInventoryStatuses() {
  console.log("Updating inventory statuses...", new Date().toISOString());

  const today = startOfDay(new Date());

  try {
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
        status: {
          notIn: [InventoryStatus.MAINTENANCE, InventoryStatus.OUT_OF_SERVICE],
        },
      },
      include: {
        bookingItems: {
          include: {
            booking: true,
          },
          where: {
            booking: {
              bookingStatus: {
                in: [
                  BookingStatus.SCHEDULED,
                  BookingStatus.CONFIRMED,
                  BookingStatus.ACTIVE,
                ],
              },
            },
          },
        },
      },
    });

    for (const inventoryItem of inventoryItems) {
      const hasCurrentBooking = inventoryItem.bookingItems.some(
        (bookingItem) => {
          const booking = bookingItem.booking;

          if (!booking) return false;

          const deliveryDate = startOfDay(new Date(booking.deliveryDate));
          const pickupDate = booking.pickupDate
            ? startOfDay(new Date(booking.pickupDate))
            : null;

          if (booking.bookingStatus === BookingStatus.ACTIVE) {
            if (booking.pickupDateUnknown) {
              return deliveryDate <= today;
            }

            if (pickupDate) {
              return deliveryDate <= today && pickupDate >= today;
            }

            return deliveryDate <= today;
          }

          if (booking.pickupDateUnknown) {
            return deliveryDate <= today;
          }

          if (pickupDate) {
            return deliveryDate <= today && pickupDate >= today;
          }

          return false;
        },
      );

      const hasFutureBooking = inventoryItem.bookingItems.some(
        (bookingItem) => {
          const booking = bookingItem.booking;

          if (!booking) return false;

          const deliveryDate = startOfDay(new Date(booking.deliveryDate));

          return (
            (booking.bookingStatus === BookingStatus.SCHEDULED ||
              booking.bookingStatus === BookingStatus.CONFIRMED) &&
            deliveryDate > today
          );
        },
      );

      const newStatus = hasCurrentBooking
        ? InventoryStatus.IN_USE
        : hasFutureBooking
          ? InventoryStatus.RESERVED
          : InventoryStatus.AVAILABLE;

      if (inventoryItem.status !== newStatus) {
        await prisma.inventoryItem.update({
          where: {
            id: inventoryItem.id,
          },
          data: {
            status: newStatus,
          },
        });

        console.log(
          `Updated ${inventoryItem.label}: ${inventoryItem.status} -> ${newStatus}`,
        );
      }
    }

    console.log("Inventory status update complete.");
  } catch (error) {
    console.error("Failed to update inventory statuses:", error);
  }
}

async function runDailyStatusUpdates() {
  await updateBookingStatuses();
  await updateInventoryStatuses();
}

export function startStatusCronJobs() {
  runDailyStatusUpdates().catch((err) => {
    console.error("Initial daily status update failed:", err);
  });

  cron.schedule("0 6 * * *", runDailyStatusUpdates, {
    timezone: "America/Denver",
  });

  cron.schedule("0 7 * * *", runDailyStatusUpdates, {
    timezone: "America/Denver",
  });

  console.log("Status cron jobs scheduled for 6 AM and 7 AM.");
}
