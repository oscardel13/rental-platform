import { Prisma } from "../generated/prisma/client.js";

export function buildBookingUpdateData(data: any) {
  const updateData: any = {};

  const setIfExists = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = value;
    }
  };

  const setNullable = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = value || null;
    }
  };

  const setNumber = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = Number(value);
    }
  };

  const setDecimal = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = new Prisma.Decimal(value);
    }
  };

  const setDate = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = value ? new Date(value) : null;
    }
  };

  const setBoolean = (key: string, value: any) => {
    if (value !== undefined) {
      updateData[key] = Boolean(value);
    }
  };

  // ===== Customer =====
  setIfExists("customerName", data.customerName);
  setIfExists("customerPhone", data.customerPhone);
  setNullable("customerEmail", data.customerEmail);

  // ===== Service =====
  setNullable("projectType", data.projectType);
  setNullable("material", data.material);
  setNullable("placement", data.placement);
  setNullable("instructions", data.instructions);
  setNullable("customerNotes", data.customerNotes);

  // ===== Address =====
  setIfExists("address1", data.address1);
  setNullable("address2", data.address2);
  setIfExists("city", data.city);
  setIfExists("state", data.state);
  setIfExists("zip", data.zip);

  // ===== Dumpster =====
  setNullable("dumpsterId", data.dumpsterId);
  setNumber("dumpsterSize", data.dumpsterSize);
  setNullable("dumpsterLabel", data.dumpsterLabel);

  // ===== Status =====
  setIfExists("bookingStatus", data.bookingStatus);
  setIfExists("paymentStatus", data.paymentStatus);

  // ===== Dates =====
  setDate("deliveryDate", data.deliveryDate);
  setDate("pickupDate", data.pickupDate);
  setBoolean("pickupDateUnknown", data.pickupDateUnknown);

  // ===== Pricing =====
  setDecimal("basePrice", data.basePrice);
  setDecimal("deliveryFee", data.deliveryFee);
  setDecimal("mileageFee", data.mileageFee);
  setDecimal("extraDaysFee", data.extraDaysFee);
  setDecimal("overageFee", data.overageFee);
  setDecimal("addonsTotal", data.addonsTotal);
  setDecimal("total", data.total);

  return updateData;
}

export function parseDateOnly(value: unknown) {
  if (!value) return null;

  const rawValue = String(value).trim();

  if (!rawValue) return null;

  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
}
