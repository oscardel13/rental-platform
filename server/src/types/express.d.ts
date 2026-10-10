// src/types/express.d.ts
import type { PlatformRole, TenantRole } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      // Set by resolveTenant from the request's Origin / Host.
      tenant?: {
        id: string;
        slug: string;
        name: string;
        timezone: string;
        status: import("../generated/prisma/client.js").TenantStatus;
      } | null;
    }

    interface User {
      id: string;
      email: string | null;
      name?: string | null;
      phone?: string | null;
      picture?: string | null;

      platformRole: PlatformRole;

      tenantId: string | null;
      tenantSlug: string | null;
      role: TenantRole | null;

      clientId: string | null;

      // Platform super admin acting inside a tenant (see requireTenantRole).
      isPlatformAdmin?: boolean;

      client?: {
        id: string;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        clientType?: string;
        businessName?: string | null;
      } | null;

      driver?: {
        id: string;
        isActive: boolean;
      } | null;

      worker?: {
        id: string;
        isActive: boolean;
      } | null;
    }
  }
}

export {};
