import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import { getIronPeakTenant } from "../tenants/tenants.helpers.js";
import { dumpstersData } from "./dumpsters.data.js";

export async function seedDumpsters(prisma: PrismaClient) {
  console.log("🗑️ Seeding inventory dumpsters...");

  const tenant = await getIronPeakTenant(prisma);

  for (const item of dumpstersData) {
    await prisma.inventoryItem.upsert({
      where: {
        id: item.id,
      },
      update: {
        tenantId: tenant.id,

        category: item.category,
        label: item.label,
        name: item.name,
        description: item.description,

        sizeValue: item.sizeValue,
        sizeUnit: item.sizeUnit,

        serialNumber: item.serialNumber,

        primaryColor: item.primaryColor,
        secondaryColor: item.secondaryColor,
        colorPattern: item.colorPattern,

        status: item.status,
        basePrice: item.basePrice,
        concretePrice: item.concretePrice,
        notes: item.notes,
        isActive: item.isActive,
      },
      create: {
        id: item.id,
        tenantId: tenant.id,

        category: item.category,
        label: item.label,
        name: item.name,
        description: item.description,

        sizeValue: item.sizeValue,
        sizeUnit: item.sizeUnit,

        serialNumber: item.serialNumber,

        primaryColor: item.primaryColor,
        secondaryColor: item.secondaryColor,
        colorPattern: item.colorPattern,

        status: item.status,
        basePrice: item.basePrice,
        concretePrice: item.concretePrice,
        notes: item.notes,
        isActive: item.isActive,
      },
    });
  }

  console.log(`   ✓ ${dumpstersData.length} inventory dumpsters seeded`);
}
