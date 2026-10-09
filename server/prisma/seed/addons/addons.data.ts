import {
  AddonPriceType,
  InventoryCategory,
} from "../../../src/generated/prisma/client.js";

// Concrete is charged through each dumpster's concretePrice (material fee)
// and priority delivery through TenantSettings, so neither is an add-on.
export const addonsData = [
  {
    code: "drivewayProtection",
    name: "Driveway Surface Protection",
    description: "Protective boards for driveway contact points.",
    price: 29.99,
    priceType: AddonPriceType.FLAT,
    category: InventoryCategory.DUMPSTER as InventoryCategory | null,
    isActive: true,
  },
];
