import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import { tenantsData } from "./tenants.data.js";

export async function seedTenants(prisma: PrismaClient) {
  console.log("🏢 Seeding tenants...");

  for (const tenant of tenantsData) {
    await prisma.tenant.upsert({
      where: {
        slug: tenant.slug,
      },
      update: {
        name: tenant.name,
        status: tenant.status,
        timezone: tenant.timezone,

        phone: tenant.phone,
        email: tenant.email,
        website: tenant.website,

        address1: tenant.address1,
        address2: tenant.address2,
        city: tenant.city,
        state: tenant.state,
        zip: tenant.zip,
        country: tenant.country,

        latitude: tenant.latitude,
        longitude: tenant.longitude,

        stripeCustomerId: tenant.stripeCustomerId,
        stripeSubscriptionId: tenant.stripeSubscriptionId,
      },
      create: tenant,
    });
  }

  console.log(`   ✓ ${tenantsData.length} tenants seeded`);
}
