import type { Request, Response } from "express";

import { getQueryString, getPublicTenant } from "../public.tenant.helper.ts";
import {
  createPublicBooking,
  createPublicBookingCheckoutDraft,
  createPublicBookingQuote,
  getPublicBookingStatus,
  updatePublicBookingCheckoutDraft,
} from "../../../services/booking/public-booking.service.ts";

function getErrorStatusCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export const HttpCreatePublicBookingQuote = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenant = await getPublicTenant(req);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const quote = await createPublicBookingQuote({
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      data: req.body,
    });

    res.json(quote);
  } catch (error) {
    console.error("Failed to create public booking quote:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create booking quote"),
    });
  }
};

export const HttpCreatePublicBookingCheckoutDraft = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenant = await getPublicTenant(req);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const checkoutDraft = await createPublicBookingCheckoutDraft({
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      data: req.body,
    });

    res.status(201).json(checkoutDraft);
  } catch (error) {
    console.error("Failed to create public checkout draft:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create checkout draft"),
    });
  }
};

export const HttpUpdatePublicBookingCheckoutDraft = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenant = await getPublicTenant(req);
    const bookingId = getQueryString(req.params.bookingId);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    if (!bookingId) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const checkoutDraft = await updatePublicBookingCheckoutDraft({
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      bookingId,
      data: req.body,
    });

    res.json(checkoutDraft);
  } catch (error) {
    console.error("Failed to update public checkout draft:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to update checkout draft"),
    });
  }
};

export const HttpCreatePublicBooking = async (req: Request, res: Response) => {
  try {
    const tenant = await getPublicTenant(req);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const booking = await createPublicBooking({
      tenantId: tenant.id,
      tenantTimezone: tenant.timezone,
      data: req.body,
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error("Failed to create public booking:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create booking"),
    });
  }
};

export const HttpGetPublicBookingStatus = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenant = await getPublicTenant(req);
    const bookingNumber = getQueryString(req.params.bookingNumber);
    const email = getQueryString(req.query.email);

    if (!tenant) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    if (!bookingNumber) {
      return res.status(400).json({
        error: "Booking number is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const bookingStatus = await getPublicBookingStatus({
      tenantId: tenant.id,
      bookingNumber,
      email,
    });

    if (!bookingStatus) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(bookingStatus);
  } catch (error) {
    console.error("Failed to fetch public booking status:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to fetch booking status"),
    });
  }
};
