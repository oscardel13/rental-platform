import { TenantRole } from "../../src/generated/prisma/client.js";

import { IRON_PEAK_TENANT_ID } from "./tenants.data.js";

// Dashboard access per tenant. A user needs a membership here to use
// /dashboard, even if they are a platform SUPER_ADMIN.
export const prodTenantMembershipsData = [
  {
    userId: "user-alejandro-owner",
    tenantId: IRON_PEAK_TENANT_ID,
    role: TenantRole.OWNER,
    isActive: true,
  },
  {
    // Platform support access. ADMIN, not OWNER, so Iron Peak stays the
    // owner of their own account.
    // TODO(prod): confirm you want standing ADMIN access to Iron Peak's
    // dashboard (remove this row if you would rather be added on request).
    userId: "user-oscar-super-admin",
    tenantId: IRON_PEAK_TENANT_ID,
    role: TenantRole.ADMIN,
    isActive: true,
  },
];

export const TENANT_MEMBERSHIPS_TODOS = [
  "memberships: confirm Oscar keeps standing ADMIN access to Iron Peak",
];
