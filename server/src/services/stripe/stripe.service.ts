import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function createServiceError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function toCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

export async function createStripePaymentIntentForBooking(booking: any) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createServiceError("Stripe secret key is missing.", 500);
  }

  const amount = toCents(booking.total);

  if (amount < 50) {
    throw createServiceError(
      "Booking total is too low for Stripe payment.",
      400,
    );
  }

  return await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    automatic_payment_methods: {
      enabled: true,
    },
    receipt_email: booking.customerEmail ?? undefined,
    metadata: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
    },
    description: `Iron Peak Services booking ${booking.bookingNumber}`,
  });
}

export async function updateStripePaymentIntentForBooking(booking: any) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createServiceError("Stripe secret key is missing.", 500);
  }

  if (!booking.stripePaymentIntentId) {
    return await createStripePaymentIntentForBooking(booking);
  }

  const existingPaymentIntent = await stripe.paymentIntents.retrieve(
    booking.stripePaymentIntentId,
  );

  if (existingPaymentIntent.status === "succeeded") {
    throw createServiceError("Paid bookings cannot be edited.", 400);
  }

  return await stripe.paymentIntents.update(booking.stripePaymentIntentId, {
    amount: toCents(booking.total),
    receipt_email: booking.customerEmail ?? undefined,
    metadata: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
    },
    description: `Iron Peak Services booking ${booking.bookingNumber}`,
  });
}
