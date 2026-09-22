// middleware/auth.ts or routes/auth/auth.middleware.ts

import type { Request, Response, NextFunction } from "express";
import { PlatformRole, TenantRole } from "../../generated/prisma/client.js";

export function checkLoggedIn(req: Request, res: Response, next: NextFunction) {
  const isLoggedIn =
    typeof req.isAuthenticated === "function" &&
    req.isAuthenticated() &&
    req.user;
  console.log("user:", req.user);

  if (!isLoggedIn) {
    return res.status(401).json({
      error: "You must log in!",
    });
  }

  next();
}

export function requireTenantRole(...allowedRoles: TenantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({
        error: "You must log in!",
      });
    }

    if (!user.tenantId || !user.role) {
      return res.status(403).json({
        error: "Tenant access required.",
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  };
}

export function requirePlatformRole(...allowedRoles: PlatformRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({
        error: "You must log in!",
      });
    }

    if (!allowedRoles.includes(user.platformRole)) {
      return res.status(403).json({
        error: "Forbidden",
      });
    }

    next();
  };
}

export const requireAdmin = requireTenantRole(
  TenantRole.OWNER,
  TenantRole.ADMIN,
);

export const requireOwner = requireTenantRole(TenantRole.OWNER);

export const requireSuperAdmin = requirePlatformRole(PlatformRole.SUPER_ADMIN);
