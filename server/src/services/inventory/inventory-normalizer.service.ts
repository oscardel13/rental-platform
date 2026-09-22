import {
  InventoryCategory,
  InventoryColor,
  InventoryPattern,
  InventoryStatus,
  InventoryUnit,
} from "../../generated/prisma/client.ts";

export function normalizeInventoryItemForOldFrontend(item: any) {
  return {
    ...item,

    // Temporary backwards-compatible fields.
    dumpsterId: item.id,
    dumpsterLabel: item.label,
    dumpsterSize: item.sizeValue ? Number(item.sizeValue) : null,

    size: item.sizeValue ? Number(item.sizeValue) : null,
    sizeLabel: item.sizeValue
      ? `${Number(item.sizeValue)} ${
          item.sizeUnit === InventoryUnit.YARD ? "Yard" : item.sizeUnit
        }`
      : null,
  };
}

export function normalizeInventoryItemsForOldFrontend(items: any[]) {
  return items.map(normalizeInventoryItemForOldFrontend);
}

export function normalizeInventoryCreateData(tenantId: string, data: any) {
  return {
    tenant: {
      connect: {
        id: tenantId,
      },
    },

    category: data.category ?? InventoryCategory.DUMPSTER,

    label: data.label,
    name: data.name ?? null,
    description: data.description ?? null,

    sizeValue:
      data.sizeValue !== undefined
        ? data.sizeValue
        : data.size !== undefined
          ? data.size
          : null,

    sizeUnit: data.sizeUnit ?? InventoryUnit.YARD,

    serialNumber: data.serialNumber ?? null,

    primaryColor: data.primaryColor ?? InventoryColor.SLATE,
    secondaryColor: data.secondaryColor ?? null,
    colorPattern: data.colorPattern ?? InventoryPattern.SOLID,

    status: data.status ?? InventoryStatus.AVAILABLE,
    notes: data.notes ?? null,
    isActive: data.isActive ?? true,

    basePrice: data.basePrice ?? 0,
    concretePrice: data.concretePrice ?? 0,
  };
}

export function normalizeInventoryUpdateData(data: any) {
  return {
    ...(data.category !== undefined ? { category: data.category } : {}),

    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined
      ? { description: data.description }
      : {}),

    ...(data.sizeValue !== undefined
      ? { sizeValue: data.sizeValue }
      : data.size !== undefined
        ? { sizeValue: data.size }
        : {}),

    ...(data.sizeUnit !== undefined ? { sizeUnit: data.sizeUnit } : {}),

    ...(data.serialNumber !== undefined
      ? { serialNumber: data.serialNumber }
      : {}),

    ...(data.primaryColor !== undefined
      ? { primaryColor: data.primaryColor }
      : {}),

    ...(data.secondaryColor !== undefined
      ? { secondaryColor: data.secondaryColor }
      : {}),

    ...(data.colorPattern !== undefined
      ? { colorPattern: data.colorPattern }
      : {}),

    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),

    ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
    ...(data.concretePrice !== undefined
      ? { concretePrice: data.concretePrice }
      : {}),
  };
}
