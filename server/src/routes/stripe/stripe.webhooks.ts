import Stripe from "stripe";

import { prisma } from "../../libs/prisma.ts";
import {
  BookingActorType,
  BookingStatus,
  NoteVisibility,
  PaymentStatus,
  BookingNoteRequestStatus,
  BookingNoteType,
  PaymentTransactionStatus,
  PaymentType,
  Prisma,
} from "../../generated/prisma/client.js";

import { checkInventoryAvailability } from "../../services/booking/booking-availability.service.ts";
import { sendBookingConfirmationEmail } from "../../emails/templates/booking-confirmation.template.ts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export function constructStripeWebhookEvent(
  rawBody: Buffer,
  signature: string,
) {
  // Events from connected accounts are delivered by a separate "Connect"
  // webhook endpoint in the Stripe dashboard, which has its own signing
  // secret. Accept either the platform or the Connect secret.
  const webhookSecrets = [
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (webhookSecrets.length === 0) {
    throw new Error(
      "Missing STRIPE_CONNECT_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET.",
    );
  }

  let lastError: unknown;

  for (const webhookSecret of webhookSecrets) {
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(paymentIntent, event.account);
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentFailed(paymentIntent, event.account);
      break;
    }

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentCanceled(paymentIntent, event.account);
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
  stripeAccountId: string | undefined,
) {
  if (!stripeAccountId) {
    console.warn(
      `Stripe ${paymentIntent.id} event has no connected account. Ignoring.`,
    );
    return null;
  }

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
      tenant: {
        select: {
          stripeAccountId: true,
        },
      },
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

  // bookingId comes from metadata, which any connected account can set.
  // Only trust the event if it came from the account that owns the booking
  // and refers to the intent we created for it.
  if (booking.tenant.stripeAccountId !== stripeAccountId) {
    console.warn(
      `Stripe ${paymentIntent.id} came from ${stripeAccountId}, but booking ${booking.id} belongs to ${booking.tenant.stripeAccountId ?? "no account"}. Ignoring.`,
    );
    return null;
  }

  if (
    booking.stripePaymentIntentId &&
    booking.stripePaymentIntentId !== paymentIntent.id
  ) {
    console.warn(
      `Stripe ${paymentIntent.id} does not match booking ${booking.id} intent ${booking.stripePaymentIntentId}. Ignoring.`,
    );
    return null;
  }

  return booking;
}

type TransactionClient = Prisma.TransactionClient;

// Returns why the booking's dumpster is unavailable, or null if it's free.
async function findScheduleConflict(booking: any) {
  const primary = getPrimaryBookingInventoryItem(booking);

  if (!primary?.inventoryItemId) return null;

  try {
    await checkInventoryAvailability({
      tenantId: booking.tenantId,
      inventoryItemId: primary.inventoryItemId,
      deliveryDate: booking.deliveryDate,
      pickupDate: booking.pickupDate,
      pickupDateUnknown: booking.pickupDateUnknown,
      ignoreBookingId: booking.id,
    });

    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Dumpster is already booked for these dates.";
  }
}

// Keeps one CHARGE row per PaymentIntent in the Payment ledger. Webhook
// retries and later status changes upsert onto the same row.
async function upsertChargePayment(
  tx: TransactionClient,
  params: {
    tenantId: string;
    bookingId: string;
    paymentIntent: Stripe.PaymentIntent;
    status: PaymentTransactionStatus;
  },
) {
  const { tenantId, bookingId, paymentIntent, status } = params;
  const succeeded = status === PaymentTransactionStatus.SUCCEEDED;
  const amountCents = succeeded
    ? paymentIntent.amount_received
    : paymentIntent.amount;
  const amount = new Prisma.Decimal(amountCents).div(100);
  const stripeChargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : (paymentIntent.latest_charge?.id ?? null);
  const failureMessage =
    status === PaymentTransactionStatus.FAILED
      ? (paymentIntent.last_payment_error?.message ?? null)
      : null;
  const paidAt = succeeded ? new Date() : null;

  await tx.payment.upsert({
    where: {
      stripePaymentIntentId_type: {
        stripePaymentIntentId: paymentIntent.id,
        type: PaymentType.CHARGE,
      },
    },
    create: {
      tenantId,
      bookingId,
      type: PaymentType.CHARGE,
      status,
      amount,
      currency: paymentIntent.currency,
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId,
      failureMessage,
      paidAt,
    },
    update: {
      status,
      amount,
      currency: paymentIntent.currency,
      stripeChargeId,
      failureMessage,
      ...(succeeded ? { paidAt } : {}),
    },
  });
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  stripeAccountId: string | undefined,
) {
  const existingBooking = await getBookingForStripePaymentIntent(
    paymentIntent,
    stripeAccountId,
  );

  if (!existingBooking) {
    return;
  }

  if (existingBooking.paymentStatus === PaymentStatus.PAID) {
    console.log(
      `Booking ${existingBooking.id} is already paid. Skipping duplicate webhook.`,
    );
    return;
  }

  // Two customers can pay for the same dumpster at the same moment (drafts
  // don't hold inventory). The money is already taken, so keep the booking,
  // but flag it for staff with an open internal alert.
  const conflictMessage = await findScheduleConflict(existingBooking);

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

    await upsertChargePayment(tx, {
      tenantId: updatedBooking.tenantId,
      bookingId: updatedBooking.id,
      paymentIntent,
      status: PaymentTransactionStatus.SUCCEEDED,
    });

    if (conflictMessage) {
      await tx.bookingNote.create({
        data: {
          tenantId: updatedBooking.tenantId,
          bookingId: updatedBooking.id,
          type: BookingNoteType.CHANGE_REQUEST,
          requestStatus: BookingNoteRequestStatus.OPEN,
          visibility: NoteVisibility.INTERNAL,
          authorType: BookingActorType.SYSTEM,
          authorLabel: "System",
          title: "Double booking: dumpster already taken",
          body: `${conflictMessage} This booking was paid anyway. Swap the dumpster or contact the customer, then mark this resolved.`,
        },
      });

      await tx.bookingHistory.create({
        data: {
          tenantId: updatedBooking.tenantId,
          bookingId: updatedBooking.id,
          eventType: "SCHEDULE_CONFLICT_ON_PAYMENT",
          actorType: BookingActorType.SYSTEM,
          actorLabel: "System",
          summary: "Paid booking overlaps another booking for the same dumpster.",
        },
      });
    }

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

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  stripeAccountId: string | undefined,
) {
  const existingBooking = await getBookingForStripePaymentIntent(
    paymentIntent,
    stripeAccountId,
  );

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

    await upsertChargePayment(tx, {
      tenantId: updatedBooking.tenantId,
      bookingId: updatedBooking.id,
      paymentIntent,
      status: PaymentTransactionStatus.FAILED,
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
  stripeAccountId: string | undefined,
) {
  const existingBooking = await getBookingForStripePaymentIntent(
    paymentIntent,
    stripeAccountId,
  );

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

    await upsertChargePayment(tx, {
      tenantId: updatedBooking.tenantId,
      bookingId: updatedBooking.id,
      paymentIntent,
      status: PaymentTransactionStatus.CANCELLED,
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
