import type { Request } from "express";

/**
 * Public routes run after resolveTenant + requireActiveTenant (routes/api.ts),
 * so the tenant always comes from the request's domain. The old
 * DEFAULT_TENANT_SLUG / ?tenant=slug lookup is gone: a site can only act for
 * the tenant that owns its domain.
 */

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
  return req.tenant ?? null;
}

export async function getPublicTenantId(req: Request) {
  return req.tenant?.id ?? null;
}
