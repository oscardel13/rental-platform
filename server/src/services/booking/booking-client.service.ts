import type { ClientType, Prisma } from "../../generated/prisma/client.js";

import type { ValidatedPublicBookingData } from "./booking-validation.service.ts";

export async function createOrUpdateClient({
  tx,
  tenantId,
  clientType,
  validated,
  data,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  clientType: ClientType;
  validated: ValidatedPublicBookingData;
  data: any;
}) {
  let client = await tx.client.findFirst({
    where: {
      tenantId,
      email: validated.customerEmail,
    },
  });

  if (!client) {
    client = await tx.client.create({
      data: {
        tenant: {
          connect: {
            id: tenantId,
          },
        },
        clientType,
        displayName: validated.customerName,
        email: validated.customerEmail,
        phone: validated.customerPhone,
        businessName: data.businessName ?? null,
        businessEmail: data.businessEmail ?? null,
        businessPhone: data.businessPhone ?? null,
        address1: validated.address1,
        address2: data.address2 ?? null,
        city: validated.city,
        state: validated.state,
        zip: validated.zip,
      },
    });
  }

  return client;
}
