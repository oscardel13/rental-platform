import { TenantStatus } from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

/**
 * Maps request hostnames to tenants using the TenantDomain table.
 *
 * Results are cached in memory for a short time so this isn't a database
 * query on every request. Adding a domain or changing a tenant's status takes
 * effect within CACHE_TTL_MS with no restart (or immediately after calling
 * clearTenantDomainCache from the code that made the change).
 */

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: TenantStatus;
};

/**
 * Statuses that may use the platform. PAST_DUE is a grace period: remove it
 * here to cut off tenants as soon as a payment fails.
 */
export const USABLE_TENANT_STATUSES: TenantStatus[] = [
  TenantStatus.ACTIVE,
  TenantStatus.TRIALING,
  TenantStatus.PAST_DUE,
];

export function isTenantUsable(status: TenantStatus | null | undefined) {
  return Boolean(status && USABLE_TENANT_STATUSES.includes(status));
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { tenant: ResolvedTenant | null; expiresAt: number }>();

export function clearTenantDomainCache() {
  cache.clear();
}

/** "https://WWW.Example.com:443/path" -> "www.example.com" */
export function normalizeHostname(value: string | null | undefined) {
  if (!value) return null;

  let host = String(value).trim().toLowerCase();

  if (!host) return null;

  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  }

  host = host.split("/")[0]!.split(":")[0]!.replace(/\.$/, "");

  return /^[a-z0-9.-]+$/.test(host) ? host : null;
}

export function isLocalHostname(hostname: string | null | undefined) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    Boolean(hostname?.endsWith(".localhost"))
  );
}

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  timezone: true,
  status: true,
} as const;

/**
 * Tenant for a hostname, or null. Unverified domains are ignored.
 * Inactive tenants ARE returned (with their status) so callers can show
 * "account not active" instead of "unknown site".
 */
export async function resolveTenantByHostname(
  hostname: string | null | undefined,
): Promise<ResolvedTenant | null> {
  const host = normalizeHostname(hostname);

  if (!host) return null;

  const cached = cache.get(host);

  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const domain = await prisma.tenantDomain.findUnique({
    where: { hostname: host },
    select: {
      verifiedAt: true,
      tenant: { select: tenantSelect },
    },
  });

  const tenant = domain?.verifiedAt ? domain.tenant : null;

  cache.set(host, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });

  return tenant;
}

/**
 * Local development only: localhost has no TenantDomain row, so it maps to
 * DEV_TENANT_SLUG (or the old DEFAULT_TENANT_SLUG). Never used in production.
 */
export async function resolveDevTenant(): Promise<ResolvedTenant | null> {
  if (process.env.NODE_ENV === "production") return null;

  const slug =
    process.env.DEV_TENANT_SLUG ||
    process.env.DEFAULT_TENANT_SLUG ||
    "iron-peak-services";

  const key = `slug:${slug}`;
  const cached = cache.get(key);

  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: tenantSelect,
  });

  cache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });

  return tenant;
}

/** Tenant for an Origin / URL / host, including the localhost dev fallback. */
export async function resolveTenantForOrigin(origin: string | null | undefined) {
  const host = normalizeHostname(origin);

  if (!host) return null;

  if (isLocalHostname(host)) return resolveDevTenant();

  return resolveTenantByHostname(host);
}

export async function getUsableTenantById(tenantId: string | null | undefined) {
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: tenantSelect,
  });

  return tenant && isTenantUsable(tenant.status) ? tenant : null;
}
