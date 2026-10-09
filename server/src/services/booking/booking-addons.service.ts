import {
  AddonPriceType,
  InventoryCategory,
  Prisma,
} from "../../generated/prisma/client.ts";
import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";

import type { PricedAddonLine } from "./booking-pricing.service.ts";

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
    priceType: AddonPriceType;
    category: InventoryCategory | null;
  };
  quantity: number;
};

// Reserved toggles that live on the booking, not in the add-on catalog.
const NON_CATALOG_ADDON_KEYS = new Set(["priorityDelivery"]);

/**
 * Accepts either an array (["addonId"], [{ code, quantity }]) or the booking
 * form's toggle map ({ drivewayProtection: true, priorityDelivery: false }),
 * where each key is an add-on code.
 */
function getSelectedAddonInputs(data: any): SelectedAddonInput[] {
  const rawAddons = Array.isArray(data?.addons)
    ? data.addons
    : data?.addons && typeof data.addons === "object"
      ? Object.entries(data.addons)
          .filter(
            ([code, value]) => value && !NON_CATALOG_ADDON_KEYS.has(code),
          )
          .map(([code, value]) => ({
            code,
            quantity: typeof value === "number" ? value : 1,
          }))
      : [];

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
  addonLines,
}: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  bookingId: string;
  addonLines: PricedAddonLine[];
}) {
  for (const line of addonLines) {
    const { addon, quantity } = line.selectedAddon;

    await tx.bookingAddon.create({
      data: {
        tenantId,
        bookingId,
        addonId: addon.id,

        addonCodeSnapshot: addon.code,
        addonNameSnapshot: addon.name,
        addonPriceSnapshot: new Prisma.Decimal(Number(addon.price || 0)),
        addonPriceTypeSnapshot: line.priceType,

        quantity,
        lineTotal: new Prisma.Decimal(line.lineTotal),
      },
    });
  }
}
