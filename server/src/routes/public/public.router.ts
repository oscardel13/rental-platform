import express from "express";

import PublicInventoryRouter from "./inventory/public.inventory.router.ts";
import PublicBookingRouter from "./booking/public.booking.router.ts";
import PublicSettingsRouter from "./settings/public.settings.router.ts";

const PublicRouter = express.Router();

PublicRouter.use("/inventory", PublicInventoryRouter);
PublicRouter.use("/bookings", PublicBookingRouter);
PublicRouter.use("/settings", PublicSettingsRouter);

export default PublicRouter;
