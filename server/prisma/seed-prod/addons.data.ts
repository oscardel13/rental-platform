import {
  AddonPriceType,
  InventoryCategory,
} from "../../src/generated/prisma/client.js";

// Optional extras a customer can tick at checkout.
//
// Not here on purpose:
// - Concrete: charged through the dumpster's concretePrice when the customer
//   picks concrete as the material (Booking.materialFee). The old
//   "concreteSurcharge" add-on double-charged that.
// - Priority delivery: TenantSettings.priorityDeliveryFee.
export const prodAddonsData = [
  {
    code: "drivewayProtection",
    name: "Driveway Surface Protection",
    description: "Protective boards for driveway contact points.",
    // TODO(prod): confirm price.
    price: 29.99,
    priceType: AddonPriceType.FLAT,
    // Only offered with dumpsters (null = offered with every category).
    category: InventoryCategory.DUMPSTER as InventoryCategory | null,
    isActive: true,
  },

  // TODO(prod): any other extras Iron Peak sells (e.g. extra tonnage,
  // mattress/appliance disposal fees, a "swap"/dump-and-return). Use
  // PER_DAY for anything billed for each rental day.
];

export const ADDONS_TODOS = [
  "addons: confirm driveway protection price",
  "addons: list any other extras Iron Peak charges for",
];
