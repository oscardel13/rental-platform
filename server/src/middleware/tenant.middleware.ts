import type { NextFunction, Request, Response } from "express";
import type { CorsOptions } from "cors";

import {
  isLocalHostname,
  isTenantUsable,
  normalizeHostname,
  resolveTenantByHostname,
  resolveTenantForOrigin,
  type ResolvedTenant,
} from "../services/tenant/tenant-domain.service.ts";

/**
 * Multi-tenant request handling.
 *
 * Every tenant's site and API hostnames live in TenantDomain and point at the
 * same ALB. For each request we work out the tenant from:
 *   1. Origin  – the site making the call (browser fetches), and
 *   2. Host    – the API hostname that was called (api.tenant.com).
 * If both resolve, they must be the same tenant.
 *
 * PLATFORM_ORIGINS (optional, comma separated) lists your own sites that are
 * not a tenant (e.g. the platform marketing site). They pass CORS but have no
 * tenant, so tenant routes reject them.
 */

const platformHosts = new Set(
  (process.env.PLATFORM_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeHostname(origin))
    .filter(Boolean) as string[],
);

const isProduction = process.env.NODE_ENV === "production";

function getOriginHeader(req: Request) {
  const origin = req.get("origin");

  if (origin && origin !== "null") return origin;

  // Top-level navigations (OAuth start) send no Origin, only Referer.
  return req.get("referer") ?? null;
}

/**
 * Sets req.tenant (or leaves it null) for every request. Does not block;
 * pair with requireActiveTenant on routes that need a tenant.
 */
export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const originHeader = getOriginHeader(req);
    const originHost = normalizeHostname(originHeader);
    const apiHost = normalizeHostname(req.hostname);

    const fromOrigin =
      originHost && !platformHosts.has(originHost)
        ? await resolveTenantForOrigin(originHost)
        : null;

    const fromHost =
      apiHost && !isLocalHostname(apiHost) && !platformHosts.has(apiHost)
        ? await resolveTenantByHostname(apiHost)
        : null;

    // A site of tenant A calling the API host of tenant B: refuse.
    if (fromOrigin && fromHost && fromOrigin.id !== fromHost.id) {
      return res.status(403).json({
        error: "This site can't access that account.",
        code: "TENANT_MISMATCH",
      });
    }

    req.tenant = fromOrigin ?? fromHost ?? null;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Blocks requests with no tenant, or whose tenant is suspended/canceled.
 * The `code` lets the frontend show a proper "account not active" page.
 */
export function requireActiveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const tenant = req.tenant;

  if (!tenant) {
    return res.status(404).json({
      error: "This site isn't set up on the platform.",
      code: "TENANT_NOT_FOUND",
    });
  }

  // Super admins can still open a suspended/canceled tenant (support).
  const isSuperAdmin =
    (req.user as { platformRole?: string } | undefined)?.platformRole ===
    "SUPER_ADMIN";

  if (!isTenantUsable(tenant.status) && !isSuperAdmin) {
    return res.status(403).json({
      error: `${tenant.name} isn't taking bookings online right now.`,
      code: "TENANT_INACTIVE",
    });
  }

  next();
}

/**
 * CORS checked against the database instead of an env list. Known tenant
 * sites are allowed even when inactive, so the browser can read the
 * TENANT_INACTIVE message instead of a bare network error.
 */
export const tenantCorsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Same-origin requests, curl, Stripe webhooks: no Origin header.
    if (!origin) return callback(null, true);

    const host = normalizeHostname(origin);

    if (!host) return callback(null, false);

    if (platformHosts.has(host)) return callback(null, true);

    if (isLocalHostname(host)) return callback(null, !isProduction);

    resolveTenantByHostname(host)
      .then((tenant) => callback(null, Boolean(tenant)))
      .catch((error) => callback(error));
  },
};

export type { ResolvedTenant };
