import { prisma } from "../../libs/prisma.js";

import {
  createStripePaymentIntentForBooking,
  updateStripePaymentIntentForBooking,
} from "../stripe/stripe.service.ts";

import {
  bookingInclude,
  normalizeBookingResponse,
} from "./booking-normalizer.service.ts";

export async function getCheckoutDraftResponse(booking: any) {
  const paymentIntent = booking.stripePaymentIntentId
    ? await updateStripePaymentIntentForBooking(booking)
    : await createStripePaymentIntentForBooking(booking);

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
  };
}
