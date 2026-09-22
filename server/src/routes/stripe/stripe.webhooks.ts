import Stripe from "stripe";

import { prisma } from "../../libs/prisma.ts";
import {
  BookingActorType,
  BookingStatus,
  NoteVisibility,
  PaymentStatus,
} from "../../generated/prisma/client.js";

import { sendBookingConfirmationEmail } from "../../emails/templates/booking-confirmation.template.ts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export function constructStripeWebhookEvent(
  rawBody: Buffer,
  signature: string,
) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentFailed(paymentIntent);
      break;
    }

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentCanceled(paymentIntent);
      break;
    }

    default: {
      console.log(`Unhandled Stripe event type: ${event.type}`);
      break;
    }
  }
}

function getPrimaryBookingInventoryItem(booking: any) {
  return (
    booking.inventoryItems?.find((item: any) => item.role === "PRIMARY") ??
    booking.inventoryItems?.[0] ??
    null
  );
}

/**
 * Temporary compatibility for old email templates/components.
 * Your email template may still expect booking.dumpster.
 */
function normalizeBookingForEmail(booking: any) {
  const primaryBookingInventoryItem = getPrimaryBookingInventoryItem(booking);

  const inventoryItem = primaryBookingInventoryItem
    ? {
        id: primaryBookingInventoryItem.inventoryItemId,
        label: primaryBookingInventoryItem.itemLabelSnapshot,
        category: primaryBookingInventoryItem.itemCategorySnapshot,
        sizeValue: primaryBookingInventoryItem.itemSizeValueSnapshot,
        sizeUnit: primaryBookingInventoryItem.itemSizeUnitSnapshot,
        serialNumber: primaryBookingInventoryItem.itemSerialSnapshot,
        basePrice: primaryBookingInventoryItem.basePriceSnapshot,
        concretePrice: primaryBookingInventoryItem.concretePriceSnapshot,

        // Old aliases.
        dumpsterId: primaryBookingInventoryItem.inventoryItemId,
        dumpsterLabel: primaryBookingInventoryItem.itemLabelSnapshot,
        dumpsterSize: primaryBookingInventoryItem.itemSizeValueSnapshot,
      }
    : null;

  return {
    ...booking,

    inventoryItem,

    // Old email/template alias.
    dumpster: inventoryItem,
    dumpsterId: inventoryItem?.id ?? null,
    dumpsterLabel: inventoryItem?.label ?? null,
    dumpsterSize: inventoryItem?.sizeValue ?? null,
  };
}

async function getBookingForStripePaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
) {
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    console.warn(`Stripe ${paymentIntent.id} is missing bookingId metadata.`);
    return null;
  }

  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    include: {
      inventoryItems: {
        include: {
          inventoryItem: true,
        },
      },
      addons: {
        include: {
          addon: true,
        },
      },
      notes: {
        where: {
          visibility: NoteVisibility.CUSTOMER,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!booking) {
    console.warn(`Booking not found for payment intent: ${paymentIntent.id}`);
    return null;
  }

  return booking;
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
) {
  const existingBooking = await getBookingForStripePaymentIntent(paymentIntent);

  if (!existingBooking) {
    return;
  }

  if (existingBooking.paymentStatus === PaymentStatus.PAID) {
    console.log(
      `Booking ${existingBooking.id} is already paid. Skipping duplicate webhook.`,
    );
    return;
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: {
        id: existingBooking.id,
      },
      data: {
        bookingStatus: BookingStatus.SCHEDULED,
        paymentStatus: PaymentStatus.PAID,
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentStatus: paymentIntent.status,
        paidAt: new Date(),
        confirmedAt: new Date(),
        scheduledAt: new Date(),
      },
      include: {
        inventoryItems: {
          include: {
            inventoryItem: true,
          },
        },
        addons: {
          include: {
            addon: true,
          },
        },
        notes: {
          where: {
            visibility: NoteVisibility.CUSTOMER,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    await tx.bookingHistory.create({
      data: {
        tenantId: updatedBooking.tenantId,
        bookingId: updatedBooking.id,
        eventType: "STRIPE_PAYMENT_SUCCEEDED",
        actorType: BookingActorType.SYSTEM,
        actorLabel: "Stripe",
        summary: "Stripe payment succeeded and booking was scheduled.",
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentStatus: paymentIntent.status,
          amountReceived: paymentIntent.amount_received,
          currency: paymentIntent.currency,
        },
      },
    });

    return updatedBooking;
  });

  await sendBookingConfirmationEmail(normalizeBookingForEmail(booking));

  console.log(`Booking ${booking.bookingNumber} confirmed by Stripe payment.`);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const existingBooking = await getBookingForStripePaymentIntent(paymentIntent);

  if (!existingBooking) {
    return;
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: {
        id: existingBooking.id,
      },
      data: {
        paymentStatus: PaymentStatus.FAILED,
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentStatus: paymentIntent.status,
      },
    });

    await tx.bookingHistory.create({
      data: {
        tenantId: updatedBooking.tenantId,
        bookingId: updatedBooking.id,
        eventType: "STRIPE_PAYMENT_FAILED",
        actorType: BookingActorType.SYSTEM,
        actorLabel: "Stripe",
        summary: "Stripe payment failed.",
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentStatus: paymentIntent.status,
          failureMessage: paymentIntent.last_payment_error?.message ?? null,
          currency: paymentIntent.currency,
        },
      },
    });

    return updatedBooking;
  });

  console.log(`Booking ${booking.id} payment failed.`);
}

async function handlePaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent,
) {
  const existingBooking = await getBookingForStripePaymentIntent(paymentIntent);

  if (!existingBooking) {
    return;
  }

  const booking = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: {
        id: existingBooking.id,
      },
      data: {
        paymentStatus: PaymentStatus.CANCELLED,
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentStatus: paymentIntent.status,
      },
    });

    await tx.bookingHistory.create({
      data: {
        tenantId: updatedBooking.tenantId,
        bookingId: updatedBooking.id,
        eventType: "STRIPE_PAYMENT_CANCELED",
        actorType: BookingActorType.SYSTEM,
        actorLabel: "Stripe",
        summary: "Stripe payment was canceled.",
        metadata: {
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentStatus: paymentIntent.status,
          cancellationReason: paymentIntent.cancellation_reason ?? null,
          currency: paymentIntent.currency,
        },
      },
    });

    return updatedBooking;
  });

  console.log(`Booking ${booking.id} payment canceled.`);
}
