// routes/client/client.routes.ts
import { Router } from "express";

import {
  requireClientDashboard,
  requireClientProfile,
} from "./client.middleware.js";

import {
  HttpGetClientMe,
  HttpGetClientBookings,
  HttpGetClientBookingById,
  HttpCreateClientBookingNote,
  HttpCreateClientBookingChangeRequest,
  HttpCreateClientBookingRescheduleRequest,
  HttpMarkClientBookingNotesRead,
  HttpPreviewClientBookingReschedule,
} from "./client.controller.js";

const ClientRouter = Router();

ClientRouter.get("/me", requireClientDashboard, HttpGetClientMe);

// Bookings Routes
ClientRouter.get(
  "/bookings",
  requireClientDashboard,
  requireClientProfile,
  HttpGetClientBookings,
);

ClientRouter.get(
  "/bookings/:id",
  requireClientDashboard,
  requireClientProfile,
  HttpGetClientBookingById,
);

ClientRouter.post(
  "/bookings/:id/notes",
  requireClientDashboard,
  requireClientProfile,
  HttpCreateClientBookingNote,
);

ClientRouter.post(
  "/bookings/:id/change-request",
  requireClientDashboard,
  requireClientProfile,
  HttpCreateClientBookingChangeRequest,
);

ClientRouter.post(
  "/bookings/:id/notes/read",
  requireClientDashboard,
  requireClientProfile,
  HttpMarkClientBookingNotesRead,
);

// Check new dates (availability + new price) before asking to reschedule
ClientRouter.get(
  "/bookings/:id/reschedule/preview",
  requireClientDashboard,
  requireClientProfile,
  HttpPreviewClientBookingReschedule,
);

ClientRouter.post(
  "/bookings/:id/reschedule",
  requireClientDashboard,
  requireClientProfile,
  HttpCreateClientBookingRescheduleRequest,
);

export default ClientRouter;
