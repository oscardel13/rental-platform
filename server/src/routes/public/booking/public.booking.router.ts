import express from "express";

import { limits } from "../../../middleware/rate-limit.ts";
import {
  HttpCreatePublicBookingCheckoutDraft,
  HttpCreatePublicBookingQuote,
  HttpGetPublicBookingStatus,
  HttpUpdatePublicBookingCheckoutDraft,
} from "./public.booking.controller.js";

const PublicBookingRouter = express.Router();

PublicBookingRouter.post("/quote", limits.quote, HttpCreatePublicBookingQuote);

// Bookings are only created through checkout drafts, which require payment
// before they're scheduled. (The old unpaid POST "/" route was removed.)
PublicBookingRouter.post(
  "/checkout-draft",
  limits.checkout,
  HttpCreatePublicBookingCheckoutDraft,
);

PublicBookingRouter.put(
  "/:bookingId/checkout-draft",
  limits.checkout,
  HttpUpdatePublicBookingCheckoutDraft,
);

PublicBookingRouter.get(
  "/:bookingNumber/status",
  limits.bookingStatus,
  HttpGetPublicBookingStatus,
);

export default PublicBookingRouter;
