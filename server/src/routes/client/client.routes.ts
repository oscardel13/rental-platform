// routes/client/client.routes.ts
import { Router } from "express";

import {
  requireAdmin,
  requireClientDashboard,
  requireClientProfile,
} from "./client.middleware.js";

import {
  HttpGetClientMe,
  HttpGetClientBookings,
  HttpGetClientBookingById,
  HttpCreateClientBookingNote,
  HttpCreateClientBookingChangeRequest,
  HttpGetClientById,
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

ClientRouter.get("/:id", requireAdmin, HttpGetClientById);

export default ClientRouter;
