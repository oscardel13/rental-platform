import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

import { ADDONS_TODOS, prodAddonsData } from "./seed-prod/addons.data.ts";
import {
  DUMPSTERS_TODOS,
  prodDumpstersData,
} from "./seed-prod/dumpsters.data.ts";
import {
  TENANT_MEMBERSHIPS_TODOS,
  prodTenantMembershipsData,
} from "./seed-prod/tenant-memberships.data.ts";
import {
  TENANTS_TODOS,
  prodTenantDomainsData,
  prodTenantSettingsData,
  prodTenantsData,
} from "./seed-prod/tenants.data.ts";
import { USERS_TODOS, prodUsersData } from "./seed-prod/users.data.ts";

// Production seed. Create-only: re-running never overwrites data that was
// changed in the dashboard. See prisma/seed-prod/README.md.

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

function checkOpenTodos() {
  const todos = [
    ...USERS_TODOS,
    ...TENANTS_TODOS,
    ...TENANT_MEMBERSHIPS_TODOS,
    ...DUMPSTERS_TODOS,
    ...ADDONS_TODOS,
  ];

  if (todos.length === 0) return;

  console.log(`⚠️  ${todos.length} open TODO(prod) items:`);
  for (const todo of todos) console.log(`   - ${todo}`);
  console.log("");

  if (process.env.ALLOW_PROD_SEED_TODOS !== "1") {
    throw new Error(
      "Fill in the TODO(prod) values (and remove them from the *_TODOS lists), " +
        "or re-run with ALLOW_PROD_SEED_TODOS=1 to seed the skeleton anyway.",
    );
  }

  console.log("ALLOW_PROD_SEED_TODOS=1 set; seeding with placeholders.\n");
}

async function seedUsers() {
  for (const user of prodUsersData) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }

  console.log(`   ✓ ${prodUsersData.length} users`);
}

async function seedTenants() {
  for (const tenant of prodTenantsData) {
    await prisma.tenant.upsert({
      where: { slug: tenant.slug },
      update: {},
      create: tenant,
    });
  }

  for (const settings of prodTenantSettingsData) {
    await prisma.tenantSettings.upsert({
      where: { tenantId: settings.tenantId },
      update: {},
      create: settings,
    });
  }

  // Seeded domains are ours, so they start verified.
  for (const domain of prodTenantDomainsData) {
    await prisma.tenantDomain.upsert({
      where: { hostname: domain.hostname },
      update: {},
      create: { ...domain, verifiedAt: new Date() },
    });
  }

  console.log(
    `   ✓ ${prodTenantsData.length} tenants, ${prodTenantSettingsData.length} tenant settings, ${prodTenantDomainsData.length} domains`,
  );
}

async function seedTenantMemberships() {
  for (const membership of prodTenantMembershipsData) {
    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: membership.userId,
          tenantId: membership.tenantId,
        },
      },
      update: {},
      create: membership,
    });
  }

  console.log(`   ✓ ${prodTenantMembershipsData.length} tenant memberships`);
}

async function seedDumpsters(tenantId: string) {
  for (const item of prodDumpstersData) {
    await prisma.inventoryItem.upsert({
      where: {
        tenantId_serialNumber: {
          tenantId,
          serialNumber: item.serialNumber,
        },
      },
      update: {},
      create: { ...item, tenantId },
    });
  }

  console.log(`   ✓ ${prodDumpstersData.length} dumpsters`);
}

async function seedAddons(tenantId: string) {
  for (const addon of prodAddonsData) {
    await prisma.addon.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: addon.code,
        },
      },
      update: {},
      create: { ...addon, tenantId },
    });
  }

  console.log(`   ✓ ${prodAddonsData.length} add-ons`);
}

async function main() {
  console.log("🌱 Production seed\n");

  checkOpenTodos();

  // Order matters: tenants and users before memberships; tenant before its
  // inventory and add-ons.
  await seedTenants();
  await seedUsers();
  await seedTenantMemberships();

  for (const tenant of prodTenantsData) {
    await seedDumpsters(tenant.id);
    await seedAddons(tenant.id);
  }

  console.log("\n✅ Production seed complete");
}

main()
  .catch((error) => {
    console.error("❌ Production seed failed:");
    console.error(error instanceof Error ? error.message : error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
