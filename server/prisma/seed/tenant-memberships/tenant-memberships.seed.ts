import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import { tenantMembershipsData } from "./tenant-memberships.data.js";

export async function seedTenantMemberships(prisma: PrismaClient) {
  console.log("👤 Seeding tenant memberships...");

  for (const membership of tenantMembershipsData) {
    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: membership.userId,
          tenantId: membership.tenantId,
        },
      },
      update: {
        role: membership.role,
        isActive: membership.isActive,
      },
      create: membership,
    });
  }

  console.log(`   ✓ ${tenantMembershipsData.length} tenant memberships seeded`);
}
