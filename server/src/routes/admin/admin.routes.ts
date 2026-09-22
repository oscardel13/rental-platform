import express from "express";

import AdminInventoryRouter from "./inventory/admin.inventory.router.ts";
import AdminBookingRouter from "./bookings/admin.booking.router.ts";
// import AdminClientRouter from "./admin.client.router.js";

const AdminRouter = express.Router();

AdminRouter.use("/inventory", AdminInventoryRouter);
AdminRouter.use("/bookings", AdminBookingRouter);
// AdminRouter.use("/clients", AdminClientRouter);

export default AdminRouter;
