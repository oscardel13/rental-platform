import type { PrismaClient } from "../../../src/generated/prisma/client.js";

export const IRON_PEAK_TENANT_SLUG = "iron-peak-services";

export async function getIronPeakTenant(prisma: PrismaClient) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      slug: IRON_PEAK_TENANT_SLUG,
    },
  });

  if (!tenant) {
    throw new Error(
      `Tenant "${IRON_PEAK_TENANT_SLUG}" was not found. Run seedTenants first.`,
    );
  }

  return tenant;
}
