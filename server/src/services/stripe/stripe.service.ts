import Stripe from "stripe";

import { prisma } from "../../libs/prisma.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

function createServiceError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function toCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createServiceError("Stripe secret key is missing.", 500);
  }
}

/**
 * Loads the tenant that owns the booking and returns its Stripe Connect
 * account. Every PaymentIntent is a direct charge on this account, so the
 * tenant is the merchant of record and funds land in their Stripe balance.
 */
export async function getTenantStripeAccountForBooking(booking: any) {
  console.log("Getting tenant for booking:", booking, booking.tenantId);
  const tenant = await prisma.tenant.findUnique({
    where: { id: booking.tenantId },
    select: { id: true, name: true, stripeAccountId: true },
  });

  if (!tenant) {
    throw createServiceError("Tenant not found for booking.", 404);
  }

  if (!tenant.stripeAccountId) {
    throw createServiceError(
      "This business has not connected a Stripe account yet.",
      409,
    );
  }

  return {
    tenantName: tenant.name,
    stripeAccountId: tenant.stripeAccountId,
  };
}

function buildPaymentIntentDetails(booking: any, tenantName: string) {
  return {
    receipt_email: booking.customerEmail ?? undefined,
    metadata: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
    },
    description: `${tenantName} booking ${booking.bookingNumber}`,
  };
}

function isMissingResourceError(error: unknown) {
  return (error as { code?: string } | null)?.code === "resource_missing";
}

export async function createStripePaymentIntentForBooking(booking: any) {
  assertStripeConfigured();

  const { tenantName, stripeAccountId } =
    await getTenantStripeAccountForBooking(booking);

  const amount = toCents(booking.total);

  if (amount < 50) {
    throw createServiceError(
      "Booking total is too low for Stripe payment.",
      400,
    );
  }

  return await stripe.paymentIntents.create(
    {
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      ...buildPaymentIntentDetails(booking, tenantName),
    },
    { stripeAccount: stripeAccountId },
  );
}

export async function updateStripePaymentIntentForBooking(booking: any) {
  assertStripeConfigured();

  if (!booking.stripePaymentIntentId) {
    return await createStripePaymentIntentForBooking(booking);
  }

  const { tenantName, stripeAccountId } =
    await getTenantStripeAccountForBooking(booking);

  let existingPaymentIntent: Stripe.PaymentIntent;

  try {
    existingPaymentIntent = await stripe.paymentIntents.retrieve(
      booking.stripePaymentIntentId,
      {},
      { stripeAccount: stripeAccountId },
    );
  } catch (error) {
    // The stored intent lives on a different account (e.g. created on the
    // platform account before the switch to Connect). Start a fresh one on
    // the tenant's connected account.
    if (isMissingResourceError(error)) {
      return await createStripePaymentIntentForBooking(booking);
    }

    throw error;
  }

  if (existingPaymentIntent.status === "succeeded") {
    throw createServiceError("Paid bookings cannot be edited.", 400);
  }

  if (existingPaymentIntent.status === "canceled") {
    return await createStripePaymentIntentForBooking(booking);
  }

  return await stripe.paymentIntents.update(
    booking.stripePaymentIntentId,
    {
      amount: toCents(booking.total),
      ...buildPaymentIntentDetails(booking, tenantName),
    },
    { stripeAccount: stripeAccountId },
  );
}
