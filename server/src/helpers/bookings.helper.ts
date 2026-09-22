import { prisma } from "../libs/prisma.ts";

type BookingPricingInput = {
  basePrice: number | string;
  concretePrice?: number | string | null;
  material?: string | null;

  rentalDays?: number | string | null;
  rentalDaysIncluded?: number | string | null;

  deliveryFee?: number | string | null;
  mileageFee?: number | string | null;
  overageFee?: number | string | null;
  addonsTotal?: number | string | null;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ValidationResult = {
  valid: boolean;
  error?: string;
  deliveryDate?: Date;
  pickupDate?: Date | null;
};

type BookingDateValidationOptions = {
  timeZone?: string;
};

const DEFAULT_BUSINESS_TIME_ZONE = "America/Denver";

const WAREHOUSE_LOCATION: Coordinates = {
  // Replace with your real warehouse coordinates
  latitude: 39.7392,
  longitude: -104.9903,
};

const FREE_MILE_RADIUS = 20;
const MILEAGE_RATE_AFTER_FREE_RADIUS = 2;
const EXTRA_DAY_RATE = 25;

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return 0;

  return numberValue;
};

function createValidationError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

export function calculateDistanceFromWarehouse(
  latitude?: number | string | null,
  longitude?: number | string | null,
) {
  if (latitude === null || latitude === undefined) return null;
  if (longitude === null || longitude === undefined) return null;

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const warehouseLat = WAREHOUSE_LOCATION.latitude;
  const warehouseLng = WAREHOUSE_LOCATION.longitude;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const earthRadiusMiles = 3958.8;

  const dLat = toRad(lat - warehouseLat);
  const dLng = toRad(lng - warehouseLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(warehouseLat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusMiles * c;

  return Number(distance.toFixed(1));
}

export function calculateMileageFee(distanceFromWarehouse?: number | null) {
  if (distanceFromWarehouse === null || distanceFromWarehouse === undefined) {
    return 0;
  }

  if (distanceFromWarehouse <= FREE_MILE_RADIUS) {
    return 0;
  }

  const billableMiles = distanceFromWarehouse - FREE_MILE_RADIUS;
  const mileageFee = billableMiles * MILEAGE_RATE_AFTER_FREE_RADIUS;

  return Number(mileageFee.toFixed(2));
}

export function calculateBookingPricing(input: BookingPricingInput) {
  const basePrice = toNumber(input.basePrice);
  const concretePrice = toNumber(input.concretePrice);
  const deliveryFee = toNumber(input.deliveryFee);
  const mileageFee = toNumber(input.mileageFee);
  const overageFee = toNumber(input.overageFee);
  const addonsTotal = toNumber(input.addonsTotal);

  const rentalDays = toNumber(input.rentalDays);
  const rentalDaysIncluded = toNumber(input.rentalDaysIncluded ?? 7);

  const extraDays =
    rentalDays > rentalDaysIncluded ? rentalDays - rentalDaysIncluded : 0;

  const extraDaysFee = extraDays * EXTRA_DAY_RATE;

  const materialSurcharge =
    input.material?.toLowerCase() === "concrete" ? concretePrice : 0;

  const total =
    basePrice +
    materialSurcharge +
    deliveryFee +
    mileageFee +
    overageFee +
    extraDaysFee +
    addonsTotal;

  return {
    basePrice: Number(basePrice.toFixed(2)),
    materialSurcharge: Number(materialSurcharge.toFixed(2)),
    deliveryFee: Number(deliveryFee.toFixed(2)),
    mileageFee: Number(mileageFee.toFixed(2)),
    overageFee: Number(overageFee.toFixed(2)),
    extraDaysFee: Number(extraDaysFee.toFixed(2)),
    addonsTotal: Number(addonsTotal.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

export async function getSelectedAddons(addonsInput: Record<string, boolean>) {
  const selectedCodes = Object.entries(addonsInput ?? {})
    .filter(([, selected]) => Boolean(selected))
    .map(([code]) => code);

  if (selectedCodes.length === 0) {
    return {
      selectedAddons: [],
      addonsTotal: 0,
    };
  }

  const selectedAddons = await prisma.addon.findMany({
    where: {
      code: {
        in: selectedCodes,
      },
      isActive: true,
    },
  });

  const addonsTotal = selectedAddons.reduce((sum, addon) => {
    return sum + Number(addon.price);
  }, 0);

  return {
    selectedAddons,
    addonsTotal: Number(addonsTotal.toFixed(2)),
  };
}

/**
 * Parses a date-only value from:
 * - "2026-09-09"
 * - "2026-09-09T00:00:00.000Z"
 * - Date
 *
 * Returns a Date at UTC midnight for storage/use with Prisma.
 * Validation comparisons should use date numbers, not Date object comparison.
 */
function parseDateOnly(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/**
 * Converts a date-only value into a YYYYMMDD number.
 * This avoids timezone bugs when comparing user-selected booking dates.
 */
function parseDateOnlyToNumber(value: unknown) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    return (
      value.getUTCFullYear() * 10000 +
      (value.getUTCMonth() + 1) * 100 +
      value.getUTCDate()
    );
  }

  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const [, year, month, day] = match;

  return Number(year) * 10000 + Number(month) * 100 + Number(day);
}

function getDatePartsInTimeZone(
  date: Date,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function getBusinessDateNumber(
  date = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);

  return year * 10000 + month * 100 + day;
}

function addDaysToDateNumber(dateNumber: number, days: number) {
  const year = Math.floor(dateNumber / 10000);
  const month = Math.floor((dateNumber % 10000) / 100);
  const day = dateNumber % 100;

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return (
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  );
}

export function validateBookingDates(
  data: any,
  options: BookingDateValidationOptions = {},
): ValidationResult {
  const timeZone = options.timeZone || DEFAULT_BUSINESS_TIME_ZONE;

  const todayNumber = getBusinessDateNumber(new Date(), timeZone);
  const tomorrowNumber = addDaysToDateNumber(todayNumber, 1);

  const deliveryDate = parseDateOnly(data.deliveryDate);
  const pickupDate = data.pickupDate ? parseDateOnly(data.pickupDate) : null;

  const deliveryDateNumber = parseDateOnlyToNumber(data.deliveryDate);
  const pickupDateNumber = data.pickupDate
    ? parseDateOnlyToNumber(data.pickupDate)
    : null;

  const pickupDateUnknown = Boolean(data.pickupDateUnknown);

  if (!deliveryDate || !deliveryDateNumber) {
    return {
      valid: false,
      error: "Delivery date is required.",
    };
  }

  if (deliveryDateNumber < tomorrowNumber) {
    return {
      valid: false,
      error:
        "Online booking starts tomorrow. For same-day delivery, please call us.",
    };
  }

  if (!pickupDateUnknown && (!pickupDate || !pickupDateNumber)) {
    return {
      valid: false,
      error: "Pickup date is required.",
    };
  }

  if (pickupDateNumber) {
    if (pickupDateNumber < tomorrowNumber) {
      return {
        valid: false,
        error:
          "Pickup date must be tomorrow or later. For same-day pickup, please call us.",
      };
    }

    if (pickupDateNumber < deliveryDateNumber) {
      return {
        valid: false,
        error: "Pickup date cannot be before delivery date.",
      };
    }
  }

  return {
    valid: true,
    deliveryDate,
    pickupDate,
  };
}

export function validateCreateBookingInput(
  data: any,
  options: BookingDateValidationOptions = {},
) {
  const dateValidation = validateBookingDates(data, options);

  if (!dateValidation.valid) {
    throw createValidationError(
      dateValidation.error || "Invalid booking dates.",
      400,
    );
  }

  return {
    ...data,
    deliveryDate: dateValidation.deliveryDate,
    pickupDate: dateValidation.pickupDate,
  };
}

export async function validatePatchBookingInput(
  id: string,
  data: any,
  options: BookingDateValidationOptions = {},
) {
  const isUpdatingDates =
    "deliveryDate" in data ||
    "pickupDate" in data ||
    "pickupDateUnknown" in data;

  if (!isUpdatingDates) {
    return data;
  }

  const existingBooking = await prisma.booking.findUnique({
    where: {
      id,
    },
    select: {
      deliveryDate: true,
      pickupDate: true,
      pickupDateUnknown: true,
    },
  });

  if (!existingBooking) {
    throw createValidationError("Booking not found.", 404);
  }

  const mergedDateData = {
    deliveryDate: data.deliveryDate ?? existingBooking.deliveryDate,
    pickupDate:
      "pickupDate" in data ? data.pickupDate : existingBooking.pickupDate,
    pickupDateUnknown:
      data.pickupDateUnknown ?? existingBooking.pickupDateUnknown,
  };

  const dateValidation = validateBookingDates(mergedDateData, options);

  if (!dateValidation.valid) {
    throw createValidationError(
      dateValidation.error || "Invalid booking dates.",
      400,
    );
  }

  return {
    ...data,
    deliveryDate: dateValidation.deliveryDate,
    pickupDate: dateValidation.pickupDate,
  };
}

export function getHttpErrorStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    return Number((error as { statusCode?: number }).statusCode) || 500;
  }

  return 500;
}

export function getHttpErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  return fallback;
}
