import express from "express";

import {
  HttpGetPublicAddons,
  HttpGetPublicAvailableInventoryItems,
  HttpGetPublicInventoryAvailabilitySummary,
} from "./public.inventory.controller.js";

const PublicInventoryRouter = express.Router();

/**
 * Public inventory routes.
 *
 * No login middleware here.
 * Used by the public booking workflow.
 *
 * Tenant resolution:
 * - now: DEFAULT_TENANT_SLUG or ?tenant=slug
 * - later: subdomain/custom domain
 */

// Calendar summary for booking date picker.
PublicInventoryRouter.get(
  "/items/availability",
  HttpGetPublicInventoryAvailabilitySummary,
);

// Available item list for a selected delivery/pickup range.
PublicInventoryRouter.get(
  "/items/available",
  HttpGetPublicAvailableInventoryItems,
);

// Public addons for booking workflow.
PublicInventoryRouter.get("/addons", HttpGetPublicAddons);

export default PublicInventoryRouter;
