import express from "express";

import {
  HttpGetInventoryItems,
  HttpGetInventoryItemById,
  HttpCreateInventoryItem,
  HttpUpdateInventoryItem,
  HttpDeleteInventoryItem,
  HttpGetAvailableInventoryItemsByDates,
  HttpGetAddons,
} from "./admin.inventory.controller.ts";

import {
  requireAdmin,
  requireTenantDashboard,
} from "../../client/client.middleware.ts";

const InventoryRouter = express.Router();

/**
 * Middleware plan:
 *
 * All inventory routes need a logged-in tenant user.
 *
 * Read routes:
 * - OWNER
 * - ADMIN
 * - DISPATCHER
 * - DRIVER
 * - WORKER
 *
 * Write routes:
 * - OWNER
 * - ADMIN
 *
 * Later, public booking flow availability should probably use a separate
 * public tenant resolver instead of req.user.tenantId.
 */

// Inventory read routes
InventoryRouter.get("/items", requireTenantDashboard, HttpGetInventoryItems);

InventoryRouter.get(
  "/items/available",
  requireTenantDashboard,
  HttpGetAvailableInventoryItemsByDates,
);

InventoryRouter.get(
  "/items/:id",
  requireTenantDashboard,
  HttpGetInventoryItemById,
);

// Inventory write routes
InventoryRouter.post("/items", requireAdmin, HttpCreateInventoryItem);

InventoryRouter.put("/items/:id", requireAdmin, HttpUpdateInventoryItem);

InventoryRouter.delete("/items/:id", requireAdmin, HttpDeleteInventoryItem);

// Addon read route
InventoryRouter.get("/addons", requireTenantDashboard, HttpGetAddons);

/**
 * Temporary old dumpster URLs.
 * Keep these only while the frontend still calls /dumpsters.
 */
InventoryRouter.get(
  "/dumpsters",
  requireTenantDashboard,
  HttpGetInventoryItems,
);

InventoryRouter.get(
  "/dumpsters/available",
  requireTenantDashboard,
  HttpGetAvailableInventoryItemsByDates,
);

InventoryRouter.get(
  "/dumpsters/:id",
  requireTenantDashboard,
  HttpGetInventoryItemById,
);

InventoryRouter.post("/dumpsters", requireAdmin, HttpCreateInventoryItem);

InventoryRouter.put("/dumpsters/:id", requireAdmin, HttpUpdateInventoryItem);

InventoryRouter.delete("/dumpsters/:id", requireAdmin, HttpDeleteInventoryItem);

export default InventoryRouter;
