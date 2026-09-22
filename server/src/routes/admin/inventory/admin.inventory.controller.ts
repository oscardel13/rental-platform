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
    res.status(500).json({ error: "Failed to fetch inventory items" });
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
    res
      .status(500)
      .json({ error: "Failed to fetch available inventory items" });
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
    res.status(500).json({ error: "Failed to fetch inventory item" });
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
    res.status(500).json({ error: "Failed to create inventory item" });
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
    res.status(500).json({ error: "Failed to update inventory item" });
  }
};

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
    res.status(500).json({ error: "Failed to delete inventory item" });
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
    res.status(500).json({ error: "Failed to fetch addons" });
  }
};

// Temporary backwards-compatible aliases.
// Remove these after the frontend is fully moved from "dumpster" to "inventory".
export const HttpGetDumpsters = HttpGetInventoryItems;
export const HttpGetAvailableDumpstersByDates =
  HttpGetAvailableInventoryItemsByDates;
export const HttpGetDumpsterById = HttpGetInventoryItemById;
export const HttpCreateDumpster = HttpCreateInventoryItem;
export const HttpUpdateDumpster = HttpUpdateInventoryItem;
export const HttpDeleteDumpster = HttpDeleteInventoryItem;
