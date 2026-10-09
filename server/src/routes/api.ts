import express from "express";

import { Router } from "express";
import publicRouter from "./public/public.router.js";
import AuthRouter from "./auth/auth.router.ts";
import StripeRouter from "./stripe/stripe.router.ts";
import ClientRouter from "./client/client.routes.ts";
import AdminRouter from "./admin/admin.routes.ts";
import ContactRouter from "./contact/contact.router.ts";
import { limits } from "../middleware/rate-limit.ts";
import {
  requireActiveTenant,
  resolveTenant,
} from "../middleware/tenant.middleware.ts";

const router = Router();

// Work out which tenant this request is for (from Origin / Host).
router.use(resolveTenant);

// Stripe is not rate limited: it retries webhooks and signs every request.
// Tenant routes: unknown sites and suspended/canceled tenants stop here.
router.use(
  "/public",
  limits.publicRead,
  requireActiveTenant,
  express.json(),
  publicRouter,
);
router.use(
  "/admin",
  limits.dashboard,
  requireActiveTenant,
  express.json(),
  AdminRouter,
);
router.use(
  "/client",
  limits.dashboard,
  requireActiveTenant,
  express.json(),
  ClientRouter,
);
router.use("/stripe", StripeRouter);
router.use("/auth", limits.auth, AuthRouter);
router.use("/contact", limits.contact, express.json(), ContactRouter);

export default router;
