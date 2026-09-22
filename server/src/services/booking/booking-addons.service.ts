import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";

export type SelectedAddonInput = {
  addonId: string | null;
  code: string | null;
  quantity: number;
};

export type SelectedAddon = {
  addon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: number | string | Prisma.Decimal | null;
  };
  quantity: number;
};

function normalizeMoney(value: unknown) {
  return Number(value || 0);
}

function getSelectedAddonInputs(data: any): SelectedAddonInput[] {
  const rawAddons = Array.isArray(data?.addons) ? data.addons : [];

  return rawAddons
    .map((addon: any): SelectedAddonInput => {
      if (typeof addon === "string") {
        return {
          addonId: addon,
          code: null,
          quantity: 1,
        };
      }

      return {
        addonId: addon?.addonId ?? addon?.id ?? null,
        code: addon?.code ?? null,
        quantity: Number(addon?.quantity || 1),
      };
    })
    .filter((addon: SelectedAddonInput) => addon.addonId || addon.code);
}

export async function getSelectedAddons({
  tenantId,
  data,
}: {
  tenantId: string;
  data: any;
}): Promise<SelectedAddon[]> {
  const selectedAddonInputs = getSelectedAddonInputs(data);

  if (selectedAddonInputs.length === 0) {
    return [];
  }

  const selectedAddonIds = selectedAddonInputs
    .map((addon: SelectedAddonInput) => addon.addonId)
    .filter(Boolean) as string[];

  const selectedAddonCodes = selectedAddonInputs
    .map((addon: SelectedAddonInput) => addon.code)
    .filter(Boolean) as string[];

  const addons = await prisma.addon.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        ...(selectedAddonIds.length
          ? [
              {
                id: {
                  in: selectedAddonIds,
                },
              },
            ]
          : []),
        ...(selectedAddonCodes.length
          ? [
              {
                code: {
                  in: selectedAddonCodes,
                },
              },
            ]
          : []),
      ],
    },
  });

  return selectedAddonInputs.map((selectedAddon: SelectedAddonInput) => {
    const addon = addons.find(
      (item) =>
        item.id === selectedAddon.addonId || item.code === selectedAddon.code,
    );

    if (!addon) {
      throw createServiceError("One or more selected addons are invalid.", 400);
    }

    return {
      addon,
      quantity: Math.max(1, selectedAddon.quantity || 1),
    };
  });
}

export async function createBookingAddonRows({
  tx,
  tenantId,
  bookingId,
  selectedAddons,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  bookingId: string;
  selectedAddons: SelectedAddon[];
}) {
  for (const selectedAddon of selectedAddons) {
    await tx.bookingAddon.create({
      data: {
        tenantId,
        bookingId,
        addonId: selectedAddon.addon.id,

        addonCodeSnapshot: selectedAddon.addon.code,
        addonNameSnapshot: selectedAddon.addon.name,
        addonPriceSnapshot: new Prisma.Decimal(
          normalizeMoney(selectedAddon.addon.price),
        ),

        quantity: selectedAddon.quantity,
      },
    });
  }
}
