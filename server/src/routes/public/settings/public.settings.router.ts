import express from "express";

import { HttpGetPublicBookingSettings } from "./public.settings.controller.ts";

const PublicSettingsRouter = express.Router();

// Booking options and fee rules for the public booking form.
PublicSettingsRouter.get("/booking", HttpGetPublicBookingSettings);

export default PublicSettingsRouter;
