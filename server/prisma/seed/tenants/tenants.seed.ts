import type { PrismaClient } from "../../../src/generated/prisma/client.js";

import {
  tenantDomainsData,
  tenantSettingsData,
  tenantsData,
} from "./tenants.data.js";

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
        stripeAccountId: tenant.stripeAccountId,
      },
      create: tenant,
    });
  }

  // Dev seed overwrites settings so changes to the data file apply on reseed.
  for (const settings of tenantSettingsData) {
    await prisma.tenantSettings.upsert({
      where: { tenantId: settings.tenantId },
      update: settings,
      create: settings,
    });
  }

  for (const domain of tenantDomainsData) {
    await prisma.tenantDomain.upsert({
      where: { hostname: domain.hostname },
      update: { tenantId: domain.tenantId, isPrimary: domain.isPrimary },
      create: { ...domain, verifiedAt: new Date() },
    });
  }

  console.log(
    `   ✓ ${tenantsData.length} tenants, ${tenantSettingsData.length} settings, ${tenantDomainsData.length} domains seeded`,
  );
}
