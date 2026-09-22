// routes/client/client.middleware.ts
import type { NextFunction, Request, Response } from "express";
import { PlatformRole, TenantRole } from "../../generated/prisma/client.js";

type AuthenticatedUser = {
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

  isActive?: boolean;
};

function getRequestUser(req: Request) {
  return req.user as AuthenticatedUser | undefined;
}

function isTenantRoleAllowed(
  userRole: TenantRole | null | undefined,
  allowedRoles: TenantRole[],
) {
  if (!userRole) return false;

  return allowedRoles.includes(userRole);
}

export function requireTenantRole(...allowedRoles: TenantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getRequestUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: "Account is inactive.",
      });
    }

    if (!user.tenantId) {
      return res.status(403).json({
        error: "Tenant access is required.",
      });
    }

    if (!isTenantRoleAllowed(user.role, allowedRoles)) {
      return res.status(403).json({
        error: "Not authorized.",
      });
    }

    next();
  };
}

export function requirePlatformRole(...allowedRoles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getRequestUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Authentication required.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: "Account is inactive.",
      });
    }

    if (!allowedRoles.includes(user.platformRole)) {
      return res.status(403).json({
        error: "Not authorized.",
      });
    }

    next();
  };
}

export const requireAdmin = requireTenantRole(
  TenantRole.OWNER,
  TenantRole.ADMIN,
);

export const requireTenantDashboard = requireTenantRole(
  TenantRole.OWNER,
  TenantRole.ADMIN,
  TenantRole.DISPATCHER,
  TenantRole.DRIVER,
  TenantRole.WORKER,
);

export const requireClientDashboard = requireTenantRole(
  TenantRole.CLIENT,
  TenantRole.OWNER,
  TenantRole.ADMIN,
);

export const requireOwner = requireTenantRole(TenantRole.OWNER);

export const requireSuperAdmin = requirePlatformRole(PlatformRole.SUPER_ADMIN);

export function requireClientProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = getRequestUser(req);

  if (!user) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  if (user.isActive === false) {
    return res.status(403).json({
      error: "Account is inactive.",
    });
  }

  if (!user.tenantId) {
    return res.status(403).json({
      error: "Tenant access is required.",
    });
  }

  // Tenant admins/owners can access client dashboard routes for testing/support.
  if (isAdminOrOwner(user)) {
    return next();
  }

  if (!user.clientId && !user.client?.id) {
    return res.status(403).json({
      error: "Client profile is required.",
    });
  }

  next();
}

export function getAuthenticatedUser(req: Request) {
  const user = getRequestUser(req);

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export function getAuthenticatedTenantId(req: Request) {
  const user = getAuthenticatedUser(req);

  if (!user.tenantId) {
    throw new Error("Tenant access is required.");
  }

  return user.tenantId;
}

export function getAuthenticatedClientId(req: Request) {
  const user = getAuthenticatedUser(req);

  const clientId = user.clientId ?? user.client?.id;

  if (!clientId) {
    throw new Error("Client profile is required.");
  }

  return clientId;
}

export function isAdminOrOwner(user: AuthenticatedUser) {
  return user.role === TenantRole.ADMIN || user.role === TenantRole.OWNER;
}

export function isSuperAdmin(user: AuthenticatedUser) {
  return user.platformRole === PlatformRole.SUPER_ADMIN;
}
