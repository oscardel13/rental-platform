import { prisma } from "../../libs/prisma.js";

import {
  createStripePaymentIntentForBooking,
  getTenantStripeAccountForBooking,
  updateStripePaymentIntentForBooking,
} from "../stripe/stripe.service.ts";

import {
  bookingInclude,
  normalizeBookingResponse,
} from "./booking-normalizer.service.ts";

export async function getCheckoutDraftResponse(booking: any) {
  const { stripeAccountId } = await getTenantStripeAccountForBooking(booking);

  const paymentIntent = booking.stripePaymentIntentId
    ? await updateStripePaymentIntentForBooking(booking)
    : await createStripePaymentIntentForBooking(booking);

  console.log("Payment intent created/updated:", paymentIntent);

  const updatedBooking = await prisma.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentStatus: paymentIntent.status,
    },
    include: bookingInclude,
  });

  return {
    booking: normalizeBookingResponse(updatedBooking),
    clientSecret: paymentIntent.client_secret,
    // The frontend must initialize Stripe.js with this account:
    // loadStripe(publishableKey, { stripeAccount: stripeAccountId })
    stripeAccountId,
  };
}
