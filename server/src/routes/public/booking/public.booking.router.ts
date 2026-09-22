import express from "express";

import {
  HttpCreatePublicBooking,
  HttpCreatePublicBookingCheckoutDraft,
  HttpCreatePublicBookingQuote,
  HttpGetPublicBookingStatus,
  HttpUpdatePublicBookingCheckoutDraft,
} from "./public.booking.controller.js";

const PublicBookingRouter = express.Router();

PublicBookingRouter.post("/quote", HttpCreatePublicBookingQuote);

PublicBookingRouter.post(
  "/checkout-draft",
  HttpCreatePublicBookingCheckoutDraft,
);

PublicBookingRouter.put(
  "/:bookingId/checkout-draft",
  HttpUpdatePublicBookingCheckoutDraft,
);

PublicBookingRouter.post("/", HttpCreatePublicBooking);

PublicBookingRouter.get("/:bookingNumber/status", HttpGetPublicBookingStatus);

export default PublicBookingRouter;
