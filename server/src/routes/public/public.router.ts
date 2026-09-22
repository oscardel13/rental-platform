import express from "express";

import PublicInventoryRouter from "./inventory/public.inventory.router.ts";
import PublicBookingRouter from "./booking/public.booking.router.ts";

const PublicRouter = express.Router();

PublicRouter.use("/inventory", PublicInventoryRouter);
PublicRouter.use("/bookings", PublicBookingRouter);

export default PublicRouter;
