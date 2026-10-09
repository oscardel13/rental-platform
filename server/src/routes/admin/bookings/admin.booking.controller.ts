import type { Request, Response } from "express";

import {
  createAdminBookingNote,
  getAdminBookingById,
  getAdminBookings,
  markAdminBookingNotesRead,
  resolveAdminBookingRequest,
  updateAdminBooking,
  updateAdminBookingStatus,
} from "../../../services/booking/admin-booking.service.ts";
import {
  createAdminBooking,
  quoteAdminBooking,
} from "../../../services/booking/admin-booking-create.service.ts";

function getTenantId(req: Request) {
  return req.user?.tenantId ?? null;
}

function getParamString(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

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
  // Only deliberate service errors (createServiceError, 4xx) are shown to
  // the caller; anything else (Prisma, Stripe, bugs) gets the fallback.
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode < 500
  ) {
    return error.message;
  }

  return fallback;
}

function requireTenantId(req: Request) {
  const tenantId = getTenantId(req);

  if (!tenantId) {
    const error = new Error("Tenant access is required.") as Error & {
      statusCode?: number;
    };

    error.statusCode = 403;
    throw error;
  }

  return tenantId;
}

function getActorLabel(req: Request) {
  return req.user?.name || req.user?.email || "Admin";
}

export const HttpCreateAdminBooking = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);

    const booking = await createAdminBooking({
      tenantId,
      data: req.body,
      actorLabel: getActorLabel(req),
      userId: req.user?.id ?? null,
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error("Failed to create admin booking:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create booking"),
    });
  }
};

export const HttpQuoteAdminBooking = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);

    const quote = await quoteAdminBooking({
      tenantId,
      data: req.body,
    });

    res.json(quote);
  } catch (error) {
    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to price booking"),
    });
  }
};

export const HttpGetAdminBookings = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);

    const bookings = await getAdminBookings({
      tenantId,
      query: req.query,
      userId: req.user?.id ?? null,
    });

    res.json(bookings);
  } catch (error) {
    console.error("Failed to fetch admin bookings:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to fetch bookings"),
    });
  }
};

export const HttpGetAdminBookingById = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const booking = await getAdminBookingById({
      tenantId,
      id,
      userId: req.user?.id ?? null,
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error("Failed to fetch admin booking:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to fetch booking"),
    });
  }
};

export const HttpUpdateAdminBooking = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const booking = await updateAdminBooking({
      tenantId,
      id,
      data: req.body,
      actorLabel: getActorLabel(req),
      userId: req.user?.id ?? null,
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error("Failed to update admin booking:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to update booking"),
    });
  }
};

export const HttpUpdateAdminBookingStatus = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const booking = await updateAdminBookingStatus({
      tenantId,
      id,
      bookingStatus: req.body?.bookingStatus,
      paymentStatus: req.body?.paymentStatus,
      cancellationReason: req.body?.cancellationReason,
      actorLabel: getActorLabel(req),
      userId: req.user?.id ?? null,
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(booking);
  } catch (error) {
    console.error("Failed to update admin booking status:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to update booking status"),
    });
  }
};

export const HttpCreateAdminBookingNote = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const note = await createAdminBookingNote({
      tenantId,
      bookingId: id,
      title: req.body?.title,
      body: req.body?.body,
      visibility: req.body?.visibility,
      actorLabel: getActorLabel(req),
      userId: req.user?.id ?? null,
    });

    res.status(201).json(note);
  } catch (error) {
    console.error("Failed to create admin booking note:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create booking note"),
    });
  }
};

export const HttpMarkAdminBookingNotesRead = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);
    const userId = req.user?.id;

    if (!id || !userId) {
      return res.status(400).json({
        error: "Booking ID is required",
      });
    }

    const result = await markAdminBookingNotesRead({ tenantId, id, userId });

    if (!result) {
      return res.status(404).json({
        error: "Booking not found",
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Failed to mark booking notes read:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to mark notes read"),
    });
  }
};

export const HttpResolveAdminBookingRequest = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = requireTenantId(req);
    const id = getParamString(req.params.id);
    const noteId = getParamString(req.params.noteId);

    if (!id || !noteId) {
      return res.status(400).json({
        error: "Booking ID and request ID are required",
      });
    }

    const booking = await resolveAdminBookingRequest({
      tenantId,
      id,
      noteId,
      action: req.body?.action,
      resolutionNote: req.body?.resolutionNote,
      actorLabel: getActorLabel(req),
      userId: req.user?.id ?? null,
    });

    res.json(booking);
  } catch (error) {
    console.error("Failed to resolve booking request:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to update request"),
    });
  }
};
