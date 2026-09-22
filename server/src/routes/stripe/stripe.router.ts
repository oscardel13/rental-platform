import express, { Router } from "express";

const StripeRouter = Router();

import { HttpStripeWebhook } from "./stripe.controller.ts";

//Routes
StripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  HttpStripeWebhook,
);

export default StripeRouter;
