import express from "express";

import { Router } from "express";
import publicRouter from "./public/public.router.js";
import AuthRouter from "./auth/auth.router.ts";
import StripeRouter from "./stripe/stripe.router.ts";
import ClientRouter from "./client/client.routes.ts";
import AdminRouter from "./admin/admin.routes.ts";

const router = Router();

router.use("/public", express.json(), publicRouter);
router.use("/admin", express.json(), AdminRouter);
router.use("/client", express.json(), ClientRouter);
router.use("/stripe", StripeRouter);
router.use("/auth", AuthRouter);

export default router;
