import { prisma } from "../../libs/prisma.js";

export async function generateBookingNumber(tenantId: string) {
  const year = new Date().getFullYear();

  const count = await prisma.booking.count({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00`),
        lt: new Date(`${year + 1}-01-01T00:00:00`),
      },
    },
  });

  return `IP-${year}-${String(count + 1).padStart(4, "0")}`;
}
