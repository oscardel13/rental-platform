import { TenantRole } from "../../src/generated/prisma/client.js";

import { IRON_PEAK_TENANT_ID } from "./tenants.data.js";

// Dashboard access per tenant for the business's own people.
// Platform super admins (users.data.ts) need no membership: they can open
// any tenant's dashboard with owner rights.
export const prodTenantMembershipsData = [
  {
    userId: "user-alejandro-owner",
    tenantId: IRON_PEAK_TENANT_ID,
    role: TenantRole.OWNER,
    isActive: true,
  },
];

export const TENANT_MEMBERSHIPS_TODOS: string[] = [];
