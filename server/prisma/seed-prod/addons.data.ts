import {
  AddonPriceType,
  InventoryCategory,
} from "../../src/generated/prisma/client.js";

export const prodAddonsData = [
  {
    code: "drivewayProtection",
    name: "Driveway Surface Protection",
    description: "Protective boards for driveway contact points.",
    price: 29.99,
    priceType: AddonPriceType.FLAT,
    // Only offered with dumpsters (null = offered with every category).
    category: InventoryCategory.DUMPSTER as InventoryCategory | null,
    isActive: true,
  },
];

// Confirmed with Iron Peak: driveway protection is the only add-on.
export const ADDONS_TODOS: string[] = [];
