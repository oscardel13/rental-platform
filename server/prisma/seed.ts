import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

import { seedTenants } from "./seed/tenants/tenants.seed.js";
import { seedAddons } from "./seed/addons/addons.seed.js";
import { seedDumpsters } from "./seed/dumpsters/dumpsters.seed.js";
import { seedDumpsterBookings } from "./seed/dumpster-bookings/dumpster-bookings.seed.js";
import { seedUsers } from "./seed/users/users.seed.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
});

async function main() {
  console.log("🌱 Starting database seed...\n");

  // Order matters:
  // 1. Tenant must exist before tenant-owned records.
  // 2. Addons and inventory must exist before bookings.
  // 3. Bookings create inventory assignments and addon snapshots.
  await seedTenants(prisma);
  await seedAddons(prisma);
  await seedDumpsters(prisma);
  await seedDumpsterBookings(prisma);
  await seedUsers(prisma);
  console.log("\n✅ Database seed complete");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
