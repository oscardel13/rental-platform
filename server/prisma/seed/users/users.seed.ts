import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { TenantRole } from "../../../src/generated/prisma/client.js";

import { getIronPeakTenant } from "../tenants/tenants.helpers.js";
import { usersData } from "./users.data.js";

export async function seedUsers(prisma: PrismaClient) {
  console.log("👤 Seeding users...");

  const tenant = await getIronPeakTenant(prisma);

  for (const user of usersData) {
    const userRecord = await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        phone: user.phone,
        picture: user.picture,
        platformRole: user.platformRole,
        isActive: user.isActive,
      },
      create: user,
    });

    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: userRecord.id,
          tenantId: tenant.id,
        },
      },
      update: {
        role: TenantRole.OWNER,
        isActive: true,
      },
      create: {
        userId: userRecord.id,
        tenantId: tenant.id,
        role: TenantRole.OWNER,
        isActive: true,
      },
    });
  }

  console.log(`   ✓ ${usersData.length} users seeded`);
}
