import type { Request, Response } from "express";

import {
  getInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  getInventoryItemsFilteredByDates,
  deleteInventoryItem,
  getAddons,
} from "../../../services/inventory/inventory.service.ts";

import {
  getErrorMessage,
  getErrorStatusCode,
} from "../../../utils/error.utils.ts";

function getTenantId(req: Request) {
  const tenantId = req.user?.tenantId;

  if (Array.isArray(tenantId)) {
    return tenantId[0] ?? null;
  }

  return tenantId ?? null;
}

function getParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

// Service errors (400 validation, 409 duplicate serial) keep their message;
// unexpected errors return the generic fallback.
function sendError(res: Response, error: unknown, fallback: string) {
  const statusCode = getErrorStatusCode(error);

  res.status(statusCode).json({
    error: statusCode < 500 ? getErrorMessage(error, fallback) : fallback,
  });
}

export const HttpGetInventoryItems = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    const inventoryItems = await getInventoryItems(tenantId, req.query);

    res.json(inventoryItems);
  } catch (error) {
    console.error("Failed to fetch inventory items:", error);
    sendError(res, error, "Failed to fetch inventory items");
  }
};

export const HttpGetAvailableInventoryItemsByDates = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    const inventoryItems = await getInventoryItemsFilteredByDates(
      tenantId,
      req.query,
    );

    res.json(inventoryItems);
  } catch (error) {
    console.error("Failed to fetch available inventory items:", error);
    sendError(res, error, "Failed to fetch available inventory items");
  }
};

export const HttpGetInventoryItemById = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = getParamString(req.params.id);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    if (!id) {
      return res.status(400).json({ error: "Inventory item ID is required" });
    }

    const inventoryItem = await getInventoryItemById(tenantId, id);

    if (!inventoryItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json(inventoryItem);
  } catch (error) {
    console.error("Failed to fetch inventory item:", error);
    sendError(res, error, "Failed to fetch inventory item");
  }
};

export const HttpCreateInventoryItem = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    const inventoryItem = await createInventoryItem(tenantId, req.body);

    res.status(201).json(inventoryItem);
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    sendError(res, error, "Failed to create inventory item");
  }
};

export const HttpUpdateInventoryItem = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = getParamString(req.params.id);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    if (!id) {
      return res.status(400).json({ error: "Inventory item ID is required" });
    }

    const inventoryItem = await updateInventoryItem(tenantId, id, req.body);

    if (!inventoryItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.json(inventoryItem);
  } catch (error) {
    console.error("Failed to update inventory item:", error);
    sendError(res, error, "Failed to update inventory item");
  }
};

// Soft delete: marks the item inactive so booking history keeps its link.
export const HttpDeleteInventoryItem = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const id = getParamString(req.params.id);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    if (!id) {
      return res.status(400).json({ error: "Inventory item ID is required" });
    }

    const success = await deleteInventoryItem(tenantId, id);

    if (!success) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    sendError(res, error, "Failed to delete inventory item");
  }
};

export const HttpGetAddons = async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant access is required" });
    }

    const addons = await getAddons(tenantId, req.query);

    res.json(addons);
  } catch (error) {
    console.error("Failed to fetch addons:", error);
    sendError(res, error, "Failed to fetch addons");
  }
};
