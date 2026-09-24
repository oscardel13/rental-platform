import { TenantRole } from "../../../src/generated/prisma/client.js";

export const tenantMembershipsData = [
  {
    userId: "user-alejandro-user",
    tenantId: "tenant-iron-peak",
    role: TenantRole.OWNER,
    isActive: true,
  },
];
