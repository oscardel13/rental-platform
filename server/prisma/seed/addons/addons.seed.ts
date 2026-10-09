import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import { getIronPeakTenant } from "../tenants/tenants.helpers.js";
import { addonsData } from "./addons.data.js";

export async function seedAddons(prisma: PrismaClient) {
  console.log("➕ Seeding addons...");

  const tenant = await getIronPeakTenant(prisma);

  for (const addon of addonsData) {
    await prisma.addon.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: addon.code,
        },
      },
      update: {
        name: addon.name,
        description: addon.description,
        price: addon.price,
        priceType: addon.priceType,
        category: addon.category,
        isActive: addon.isActive,
      },
      create: {
        tenantId: tenant.id,
        code: addon.code,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        priceType: addon.priceType,
        category: addon.category,
        isActive: addon.isActive,
      },
    });
  }

  // Older dev databases have this add-on; it double-charged concrete.
  await prisma.addon.updateMany({
    where: { tenantId: tenant.id, code: "concreteSurcharge" },
    data: { isActive: false },
  });

  console.log(`   ✓ ${addonsData.length} addons seeded`);
}
