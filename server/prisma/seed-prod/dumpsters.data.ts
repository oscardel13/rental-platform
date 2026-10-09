import {
  InventoryCategory,
  InventoryColor,
  InventoryPattern,
  InventoryStatus,
  InventoryUnit,
} from "../../src/generated/prisma/client.js";

// Shared terms per size so every can of the same size prices the same.
// TODO(prod): confirm base price, concrete price, days included and extra
// day rate for each size.
const SIZE_17 = {
  sizeValue: 17,
  basePrice: 375,
  // Charged as Booking.materialFee when the customer picks concrete.
  concretePrice: 150,
  rentalDaysIncluded: 7,
  // Current site copy says $25/day after the included days.
  extraDayRate: 25,
};

const SIZE_22 = {
  sizeValue: 22,
  basePrice: 450,
  concretePrice: 180,
  rentalDaysIncluded: 7,
  extraDayRate: 25,
};

function dumpster(
  size: typeof SIZE_17,
  number: number,
  serialNumber: string,
  colors: {
    primaryColor: InventoryColor;
    secondaryColor: InventoryColor | null;
    colorPattern: InventoryPattern;
  },
) {
  const label = `${size.sizeValue} Yard Dumpster #${number}`;

  return {
    category: InventoryCategory.DUMPSTER,
    label,
    name: label,
    description: null,

    sizeValue: size.sizeValue,
    sizeUnit: InventoryUnit.YARD,

    serialNumber,
    ...colors,

    status: InventoryStatus.AVAILABLE,

    basePrice: size.basePrice,
    concretePrice: size.concretePrice,
    rentalDaysIncluded: size.rentalDaysIncluded,
    extraDayRate: size.extraDayRate,

    notes: null,
    isActive: true,
  };
}

// TODO(prod): real fleet. For each can: its number/serial painted on the box
// and its actual paint colors (each color combo should be unique so drivers
// can tell cans apart; the dashboard warns on duplicates). The five below
// mirror the dev seed and are placeholders until Iron Peak confirms.
export const prodDumpstersData = [
  dumpster(SIZE_17, 1, "IPS-17-001", {
    primaryColor: InventoryColor.EMERALD,
    secondaryColor: null,
    colorPattern: InventoryPattern.SOLID,
  }),
  dumpster(SIZE_17, 2, "IPS-17-002", {
    primaryColor: InventoryColor.EMERALD,
    secondaryColor: InventoryColor.PINK,
    colorPattern: InventoryPattern.STRIPE,
  }),
  dumpster(SIZE_17, 3, "IPS-17-003", {
    primaryColor: InventoryColor.EMERALD,
    secondaryColor: InventoryColor.ORANGE,
    colorPattern: InventoryPattern.DOT,
  }),
  dumpster(SIZE_22, 1, "IPS-22-001", {
    primaryColor: InventoryColor.BLUE,
    secondaryColor: null,
    colorPattern: InventoryPattern.SOLID,
  }),
  dumpster(SIZE_22, 2, "IPS-22-002", {
    primaryColor: InventoryColor.BLUE,
    secondaryColor: InventoryColor.ROSE,
    colorPattern: InventoryPattern.SPLIT,
  }),
];

export const DUMPSTERS_TODOS = [
  "dumpsters: real fleet list (count per size, serial numbers, colors)",
  "dumpsters: confirm price, concrete price, days included, extra-day rate per size",
];
