import { PlatformRole } from "../../src/generated/prisma/client.js";

// Platform-level accounts. Tenant access comes from tenant-memberships, not
// from this file. Users sign in with Google, so no passwords are seeded; the
// email here must match the Google account they sign in with.
export const prodUsersData = [
  {
    id: "user-oscar-super-admin",
    name: "Oscar",
    email: "oscardel413@gmail.com",
    phone: null,
    picture: null,
    platformRole: PlatformRole.SUPER_ADMIN,
    isActive: true,
  },
  {
    id: "user-oscarshub-super-admin",
    name: "Oscar Hub",
    email: "oscar@oscarshub.com",
    phone: null,
    picture: null,
    platformRole: PlatformRole.SUPER_ADMIN,
    isActive: true,
  },
  {
    id: "user-alejandro-owner",
    name: "Alejandro",
    // TODO(prod): confirm this is the Google account Alejandro will sign in
    // with (it is also the tenant's public email).
    email: "ironpeakservices.llc@gmail.com",
    phone: "7208257521",
    picture: null,
    platformRole: PlatformRole.USER,
    isActive: true,
  },

  // TODO(prod): add any Iron Peak staff (dispatchers, drivers) who need a
  // dashboard login on day one, then give them a membership below.
];

export const USERS_TODOS = [
  "users: confirm Alejandro's sign-in email",
  "users: add Iron Peak staff accounts (dispatchers/drivers), if any",
];
