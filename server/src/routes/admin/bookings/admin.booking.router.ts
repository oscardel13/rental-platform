import express from "express";

import {
  HttpCreateAdminBooking,
  HttpCreateAdminBookingNote,
  HttpGetAdminBookingById,
  HttpGetAdminBookings,
  HttpMarkAdminBookingNotesRead,
  HttpQuoteAdminBooking,
  HttpResolveAdminBookingRequest,
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

// Create a booking for a phone/walk-in customer (priced on the server)
AdminBookingRouter.post("/", requireAdmin, HttpCreateAdminBooking);

// Live price preview for the New Booking form
AdminBookingRouter.post("/quote", requireAdmin, HttpQuoteAdminBooking);

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

// Read receipts: anyone on the dashboard team can mark notes as seen
AdminBookingRouter.post(
  "/:id/notes/read",
  requireTenantDashboard,
  HttpMarkAdminBookingNotesRead,
);

// Approve / decline / resolve a customer change or reschedule request
AdminBookingRouter.patch(
  "/:id/requests/:noteId",
  requireAdmin,
  HttpResolveAdminBookingRequest,
);

export default AdminBookingRouter;
