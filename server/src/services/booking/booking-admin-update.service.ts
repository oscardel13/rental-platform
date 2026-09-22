import { Prisma } from "../../generated/prisma/client.ts";

import { createServiceError } from "../../utils/error.utils.ts";
import { parseDateOnly } from "../../utils/date.utils.ts";
import { toDecimal } from "../../utils/prisma.utils.ts";

function requireDateOnly(value: unknown, fieldName: string) {
  const date = parseDateOnly(value);

  if (!date) {
    throw createServiceError(
      `${fieldName} must be a valid YYYY-MM-DD date.`,
      400,
    );
  }

  return date;
}

export function normalizeAdminBookingUpdateData(
  data: any,
): Prisma.BookingUpdateInput {
  return {
    ...(data.customerName !== undefined
      ? { customerName: data.customerName }
      : {}),
    ...(data.customerPhone !== undefined
      ? { customerPhone: data.customerPhone }
      : {}),
    ...(data.customerEmail !== undefined
      ? { customerEmail: data.customerEmail }
      : {}),

    ...(data.clientType !== undefined ? { clientType: data.clientType } : {}),
    ...(data.businessName !== undefined
      ? { businessName: data.businessName }
      : {}),
    ...(data.businessPhone !== undefined
      ? { businessPhone: data.businessPhone }
      : {}),
    ...(data.businessEmail !== undefined
      ? { businessEmail: data.businessEmail }
      : {}),

    ...(data.address1 !== undefined ? { address1: data.address1 } : {}),
    ...(data.address2 !== undefined ? { address2: data.address2 } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.state !== undefined ? { state: data.state } : {}),
    ...(data.zip !== undefined ? { zip: data.zip } : {}),

    /**
     * Only keep this if Booking actually has country.
     * Earlier your schema looked like country was on Client, not Booking.
     */
    ...(data.country !== undefined ? { country: data.country } : {}),

    ...(data.placement !== undefined ? { placement: data.placement } : {}),
    ...(data.instructions !== undefined
      ? { instructions: data.instructions }
      : {}),
    ...(data.customerNotes !== undefined
      ? { customerNotes: data.customerNotes }
      : {}),

    ...(data.locationVerified !== undefined
      ? { locationVerified: data.locationVerified }
      : {}),
    ...(data.locationVerificationNote !== undefined
      ? { locationVerificationNote: data.locationVerificationNote }
      : {}),

    ...(data.deliveryDate !== undefined
      ? {
          deliveryDate: requireDateOnly(data.deliveryDate, "Delivery date"),
        }
      : {}),

    ...(data.pickupDate !== undefined
      ? {
          pickupDate: data.pickupDate
            ? requireDateOnly(data.pickupDate, "Pickup date")
            : null,
        }
      : {}),

    ...(data.pickupDateUnknown !== undefined
      ? { pickupDateUnknown: data.pickupDateUnknown }
      : {}),

    ...(data.rentalDaysIncluded !== undefined
      ? { rentalDaysIncluded: Number(data.rentalDaysIncluded) }
      : {}),

    ...(data.priorityDelivery !== undefined
      ? { priorityDelivery: data.priorityDelivery }
      : {}),

    ...(data.deliveryTime !== undefined
      ? {
          deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
        }
      : {}),

    ...(data.priorityDeliveryNote !== undefined
      ? { priorityDeliveryNote: data.priorityDeliveryNote }
      : {}),

    ...(data.bookingStatus !== undefined
      ? { bookingStatus: data.bookingStatus }
      : {}),
    ...(data.paymentStatus !== undefined
      ? { paymentStatus: data.paymentStatus }
      : {}),

    ...(data.basePrice !== undefined
      ? { basePrice: toDecimal(data.basePrice) }
      : {}),
    ...(data.deliveryFee !== undefined
      ? { deliveryFee: toDecimal(data.deliveryFee) }
      : {}),
    ...(data.mileageFee !== undefined
      ? { mileageFee: toDecimal(data.mileageFee) }
      : {}),
    ...(data.extraDaysFee !== undefined
      ? { extraDaysFee: toDecimal(data.extraDaysFee) }
      : {}),
    ...(data.overageFee !== undefined
      ? { overageFee: toDecimal(data.overageFee) }
      : {}),
    ...(data.addonsTotal !== undefined
      ? { addonsTotal: toDecimal(data.addonsTotal) }
      : {}),
    ...(data.total !== undefined ? { total: toDecimal(data.total) } : {}),
  };
}
