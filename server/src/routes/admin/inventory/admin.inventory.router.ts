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
 * Write routes (create, update, deactivate) — requireAdmin:
 * - OWNER
 * - ADMIN
 *
 * Later, public booking flow availability should probably use a separate
 * public tenant resolver instead of req.user.tenantId.
 */

// Inventory read routes
// GET /items?includeInactive=true&status=AVAILABLE&category=DUMPSTER
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

// Soft delete: sets isActive = false.
InventoryRouter.delete("/items/:id", requireAdmin, HttpDeleteInventoryItem);

// Addon read route
InventoryRouter.get("/addons", requireTenantDashboard, HttpGetAddons);

export default InventoryRouter;
