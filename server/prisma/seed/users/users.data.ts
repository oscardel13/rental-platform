import { PlatformRole } from "../../../src/generated/prisma/client.js";

export const usersData = [
  {
    id: "user-oscar-super-admin",
    name: "Oscar",
    email: "oscardel413@gmail.com",
    phone: null,
    picture: null,
    platformRole: PlatformRole.SUPER_ADMIN,
    isActive: true,
  },
];
