import { PlatformRole } from "../../src/generated/prisma/client.js";

// Accounts that exist on day one. Users sign in with Google, so no passwords
// are seeded; each email must match the Google account they sign in with.
//
// SUPER_ADMIN = platform owner: can open any tenant's dashboard with owner
// rights, no membership needed. Everyone else gets tenant access from
// tenant-memberships.data.ts.
export const prodUsersData = [
  {
    id: "user-oscarshub-super-admin",
    name: "Oscar",
    email: "oscar@oscarshub.com",
    phone: null,
    picture: null,
    platformRole: PlatformRole.SUPER_ADMIN,
    isActive: true,
  },
  {
    // Backup login (e.g. from the phone).
    id: "user-oscar-super-admin",
    name: "Oscar",
    email: "oscardel0413@gmail.com",
    phone: null,
    picture: null,
    platformRole: PlatformRole.SUPER_ADMIN,
    isActive: true,
  },
  {
    // Iron Peak owner; also the business's public email.
    id: "user-alejandro-owner",
    name: "Alejandro",
    email: "ironpeakservices.llc@gmail.com",
    phone: "7208257521",
    picture: null,
    platformRole: PlatformRole.USER,
    isActive: true,
  },
];

// Staff accounts will be added from the tenant dashboard later.
export const USERS_TODOS: string[] = [];
