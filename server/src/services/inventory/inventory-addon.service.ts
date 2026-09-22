import { prisma } from "../../libs/prisma.ts";

import { createServiceError } from "../../utils/error.utils.ts";

export const getAddons = async (tenantId: string, query: any) => {
  const addons = await prisma.addon.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return addons;
};

export const getAddonById = async (tenantId: string, id: string) => {
  return prisma.addon.findFirst({
    where: {
      tenantId,
      id,
    },
  });
};

export const createAddon = async (tenantId: string, data: any) => {
  if (!data.code) {
    throw createServiceError("Addon code is required.", 400);
  }

  if (!data.name) {
    throw createServiceError("Addon name is required.", 400);
  }

  return prisma.addon.create({
    data: {
      tenant: {
        connect: {
          id: tenantId,
        },
      },
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      price: data.price ?? 0,
      isActive: data.isActive ?? true,
    },
  });
};

export const updateAddon = async (tenantId: string, id: string, data: any) => {
  const existingAddon = await prisma.addon.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingAddon) {
    return null;
  }

  return prisma.addon.update({
    where: {
      id,
    },
    data: {
      ...(data.code !== undefined ? { code: data.code } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.price !== undefined ? { price: data.price } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
};

export const deleteAddon = async (tenantId: string, id: string) => {
  const existingAddon = await prisma.addon.findFirst({
    where: {
      tenantId,
      id,
    },
  });

  if (!existingAddon) {
    return false;
  }

  await prisma.addon.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });

  return true;
};
