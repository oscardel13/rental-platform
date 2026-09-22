import express from "express";

import {
  HttpCreateAdminBookingNote,
  HttpGetAdminBookingById,
  HttpGetAdminBookings,
  HttpUpdateAdminBooking,
  HttpUpdateAdminBookingStatus,
} from "./admin.booking.controller.js";

import {
  requireAdmin,
  requireTenantDashboard,
} from "../../client/client.middleware.ts";

const AdminBookingRouter = express.Router();

/**
 * Admin booking routes.
 *
 * Middleware:
 * - Read routes use requireTenantDashboard:
 *   OWNER, ADMIN, DISPATCHER, DRIVER, WORKER
 *
 * - Write routes use requireAdmin for now:
 *   OWNER, ADMIN
 *
 * Later you may want a separate requireDispatcherAccess middleware for:
 *   OWNER, ADMIN, DISPATCHER
 */

// Read bookings
AdminBookingRouter.get("/", requireTenantDashboard, HttpGetAdminBookings);

AdminBookingRouter.get("/:id", requireTenantDashboard, HttpGetAdminBookingById);

// Update full/partial booking details
AdminBookingRouter.patch("/:id", requireAdmin, HttpUpdateAdminBooking);

// Update only booking status
AdminBookingRouter.patch(
  "/:id/status",
  requireAdmin,
  HttpUpdateAdminBookingStatus,
);

// Add internal admin note
AdminBookingRouter.post("/:id/notes", requireAdmin, HttpCreateAdminBookingNote);

export default AdminBookingRouter;
