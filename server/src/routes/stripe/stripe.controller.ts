import type { Request, Response } from "express";

import {
  constructStripeWebhookEvent,
  handleStripeWebhookEvent,
} from "./stripe.webhooks.ts";

export const HttpStripeWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["stripe-signature"];

    if (!signature || Array.isArray(signature)) {
      return res.status(400).send("Missing Stripe signature.");
    }

    const event = constructStripeWebhookEvent(req.body, signature);

    await handleStripeWebhookEvent(event);

    res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    // 400 tells Stripe to retry later; details stay in our logs.
    res.status(400).send("Webhook error");
  }
};
