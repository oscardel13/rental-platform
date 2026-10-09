import type { Request, Response } from "express";

import {
  getAddons,
  getInventoryItemsFilteredByDates,
  getPublicInventoryAvailabilitySummary,
} from "../../../services/inventory/inventory.service.ts";

import { getPublicTenantId } from "../public.tenant.helper.ts";

export const HttpGetPublicAvailableInventoryItems = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = await getPublicTenantId(req);

    if (!tenantId) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const inventoryItems = await getInventoryItemsFilteredByDates(
      tenantId,
      req.query,
    );

    res.json(inventoryItems);
  } catch (error) {
    console.error("Failed to fetch public available inventory items:", error);

    res.status(500).json({
      error: "Failed to fetch available inventory items",
    });
  }
};

export const HttpGetPublicAddons = async (req: Request, res: Response) => {
  try {
    const tenantId = await getPublicTenantId(req);

    if (!tenantId) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const addons = await getAddons(tenantId, req.query);

    res.json(addons);
  } catch (error) {
    console.error("Failed to fetch public addons:", error);

    res.status(500).json({
      error: "Failed to fetch addons",
    });
  }
};

export const HttpGetPublicInventoryAvailabilitySummary = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = await getPublicTenantId(req);

    if (!tenantId) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const availability = await getPublicInventoryAvailabilitySummary(
      tenantId,
      req.query,
    );

    res.json(availability);
  } catch (error) {
    console.error("Failed to fetch public inventory availability:", error);

    res.status(500).json({
      error: "Failed to fetch inventory availability",
    });
  }
};
