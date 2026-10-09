import {
  InventoryCategory,
  InventoryColor,
  InventoryPattern,
  InventoryStatus,
  InventoryUnit,
} from "../../generated/prisma/client.ts";

import { createServiceError } from "../../utils/error.utils.ts";

/**
 * Response shape
 */

const SIZE_UNIT_LABELS: Record<InventoryUnit, string> = {
  [InventoryUnit.YARD]: "Yard",
  [InventoryUnit.FOOT]: "ft",
  [InventoryUnit.INCH]: "in",
  [InventoryUnit.TON]: "Ton",
  [InventoryUnit.POUND]: "lb",
  [InventoryUnit.GALLON]: "gal",
  [InventoryUnit.UNIT]: "",
};

export function formatInventorySizeLabel(
  size: number | null,
  sizeUnit: InventoryUnit | null | undefined,
) {
  if (size === null) return null;

  const unitLabel = sizeUnit ? SIZE_UNIT_LABELS[sizeUnit] : "";

  return unitLabel ? `${size} ${unitLabel}` : String(size);
}

// Adds `size` (number) and `sizeLabel` ("20 Yard") for the dashboard.
export function normalizeInventoryItemResponse(item: any) {
  const size =
    item.sizeValue !== null && item.sizeValue !== undefined
      ? Number(item.sizeValue)
      : null;

  return {
    ...item,
    size,
    sizeLabel: formatInventorySizeLabel(size, item.sizeUnit),
  };
}

export function normalizeInventoryItemsResponse(items: any[]) {
  return items.map(normalizeInventoryItemResponse);
}

/**
 * Input validation
 */

function parseEnumValue<T extends string>(
  enumObject: Record<string, T>,
  value: unknown,
  field: string,
): T {
  const allowedValues = Object.values(enumObject);

  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw createServiceError(
      `Invalid ${field}. Expected one of: ${allowedValues.join(", ")}.`,
      400,
    );
  }

  return value as T;
}

function parseNullableEnumValue<T extends string>(
  enumObject: Record<string, T>,
  value: unknown,
  field: string,
): T | null {
  if (value === null || value === "") return null;

  return parseEnumValue(enumObject, value, field);
}

function parseNullableString(value: unknown) {
  if (value === null || value === undefined) return null;

  const stringValue = String(value).trim();

  return stringValue || null;
}

function parseLabel(value: unknown) {
  const label = parseNullableString(value);

  if (!label) {
    throw createServiceError("Inventory item label is required.", 400);
  }

  return label;
}

function parseNullableNumber(value: unknown, field: string) {
  if (value === null || value === "") return null;

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw createServiceError(`${field} must be a number of 0 or more.`, 400);
  }

  return numberValue;
}

function parseMoney(value: unknown, field: string) {
  return parseNullableNumber(value, field) ?? 0;
}

function parseBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw createServiceError(`${field} must be true or false.`, 400);
  }

  return value;
}

/**
 * Color combination rules (the dashboard follows the same ones):
 * - SOLID has no secondary color.
 * - STRIPE / SPLIT / DOT need a secondary color different from the primary.
 */
export function resolveColorCombo(combo: {
  primaryColor: InventoryColor;
  secondaryColor: InventoryColor | null;
  colorPattern: InventoryPattern;
}) {
  if (combo.colorPattern === InventoryPattern.SOLID) {
    return { ...combo, secondaryColor: null };
  }

  if (!combo.secondaryColor) {
    throw createServiceError(
      `The ${combo.colorPattern.toLowerCase()} pattern needs a secondary color.`,
      400,
    );
  }

  if (combo.secondaryColor === combo.primaryColor) {
    throw createServiceError(
      "Secondary color must be different from the primary color.",
      400,
    );
  }

  return combo;
}

// Days of rental included in the base price.
function parseRentalDaysIncluded(value: unknown) {
  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw createServiceError(
      "Rental days included must be a whole number from 1 to 365.",
      400,
    );
  }

  return days;
}

// Accepts `sizeValue` or the dashboard's `size`.
function getSizeInput(data: any) {
  return data.sizeValue !== undefined ? data.sizeValue : data.size;
}

export function normalizeInventoryCreateData(tenantId: string, data: any) {
  const sizeInput = getSizeInput(data);

  const colorCombo = resolveColorCombo({
    primaryColor:
      data.primaryColor !== undefined
        ? parseEnumValue(InventoryColor, data.primaryColor, "primaryColor")
        : InventoryColor.SLATE,
    secondaryColor:
      data.secondaryColor !== undefined
        ? parseNullableEnumValue(
            InventoryColor,
            data.secondaryColor,
            "secondaryColor",
          )
        : null,
    colorPattern:
      data.colorPattern !== undefined
        ? parseEnumValue(InventoryPattern, data.colorPattern, "colorPattern")
        : InventoryPattern.SOLID,
  });

  return {
    tenant: {
      connect: {
        id: tenantId,
      },
    },

    category:
      data.category !== undefined
        ? parseEnumValue(InventoryCategory, data.category, "category")
        : InventoryCategory.DUMPSTER,

    label: parseLabel(data.label),
    name: parseNullableString(data.name),
    description: parseNullableString(data.description),

    sizeValue:
      sizeInput !== undefined ? parseNullableNumber(sizeInput, "Size") : null,

    sizeUnit:
      data.sizeUnit !== undefined
        ? parseEnumValue(InventoryUnit, data.sizeUnit, "sizeUnit")
        : InventoryUnit.YARD,

    serialNumber: parseNullableString(data.serialNumber),

    ...colorCombo,

    status:
      data.status !== undefined
        ? parseEnumValue(InventoryStatus, data.status, "status")
        : InventoryStatus.AVAILABLE,

    notes: parseNullableString(data.notes),

    isActive:
      data.isActive !== undefined
        ? parseBoolean(data.isActive, "isActive")
        : true,

    basePrice:
      data.basePrice !== undefined ? parseMoney(data.basePrice, "Base price") : 0,

    concretePrice:
      data.concretePrice !== undefined
        ? parseMoney(data.concretePrice, "Concrete price")
        : 0,

    rentalDaysIncluded:
      data.rentalDaysIncluded !== undefined
        ? parseRentalDaysIncluded(data.rentalDaysIncluded)
        : 7,

    extraDayRate:
      data.extraDayRate !== undefined
        ? parseMoney(data.extraDayRate, "Extra day rate")
        : 0,
  };
}

// Only fields present in the body are updated. Color fields are checked
// against the existing item in updateInventoryItem (resolveColorCombo).
export function normalizeInventoryUpdateData(data: any) {
  const sizeInput = getSizeInput(data);

  return {
    ...(data.category !== undefined
      ? { category: parseEnumValue(InventoryCategory, data.category, "category") }
      : {}),

    ...(data.label !== undefined ? { label: parseLabel(data.label) } : {}),
    ...(data.name !== undefined ? { name: parseNullableString(data.name) } : {}),
    ...(data.description !== undefined
      ? { description: parseNullableString(data.description) }
      : {}),

    ...(sizeInput !== undefined
      ? { sizeValue: parseNullableNumber(sizeInput, "Size") }
      : {}),

    ...(data.sizeUnit !== undefined
      ? { sizeUnit: parseEnumValue(InventoryUnit, data.sizeUnit, "sizeUnit") }
      : {}),

    ...(data.serialNumber !== undefined
      ? { serialNumber: parseNullableString(data.serialNumber) }
      : {}),

    ...(data.primaryColor !== undefined
      ? {
          primaryColor: parseEnumValue(
            InventoryColor,
            data.primaryColor,
            "primaryColor",
          ),
        }
      : {}),

    ...(data.secondaryColor !== undefined
      ? {
          secondaryColor: parseNullableEnumValue(
            InventoryColor,
            data.secondaryColor,
            "secondaryColor",
          ),
        }
      : {}),

    ...(data.colorPattern !== undefined
      ? {
          colorPattern: parseEnumValue(
            InventoryPattern,
            data.colorPattern,
            "colorPattern",
          ),
        }
      : {}),

    ...(data.status !== undefined
      ? { status: parseEnumValue(InventoryStatus, data.status, "status") }
      : {}),

    ...(data.notes !== undefined
      ? { notes: parseNullableString(data.notes) }
      : {}),

    ...(data.isActive !== undefined
      ? { isActive: parseBoolean(data.isActive, "isActive") }
      : {}),

    ...(data.basePrice !== undefined
      ? { basePrice: parseMoney(data.basePrice, "Base price") }
      : {}),

    ...(data.concretePrice !== undefined
      ? { concretePrice: parseMoney(data.concretePrice, "Concrete price") }
      : {}),

    ...(data.rentalDaysIncluded !== undefined
      ? { rentalDaysIncluded: parseRentalDaysIncluded(data.rentalDaysIncluded) }
      : {}),

    ...(data.extraDayRate !== undefined
      ? { extraDayRate: parseMoney(data.extraDayRate, "Extra day rate") }
      : {}),
  };
}
