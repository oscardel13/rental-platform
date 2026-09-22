import type { Request } from "express";

import { prisma } from "../../libs/prisma.js";

const DEFAULT_TENANT_SLUG =
  process.env.DEFAULT_TENANT_SLUG || "iron-peak-services";

export function getQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

export async function getPublicTenant(req: Request) {
  const queryTenantSlug = getQueryString(req.query.tenant);
  const tenantSlug = queryTenantSlug || DEFAULT_TENANT_SLUG;

  return prisma.tenant.findUnique({
    where: {
      slug: tenantSlug,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      timezone: true,
      status: true,
    },
  });
}

export async function getPublicTenantId(req: Request) {
  const tenant = await getPublicTenant(req);

  return tenant?.id ?? null;
}
