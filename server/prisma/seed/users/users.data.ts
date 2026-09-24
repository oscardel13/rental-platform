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
  {
    id: "user-alejandro-user",
    name: "Alejandro",
    email: "ironpeakservices.llc@gmail.com",
    phone: "7208257521",
    picture: null,
    platformRole: PlatformRole.USER,
    isActive: true,
  },
];
