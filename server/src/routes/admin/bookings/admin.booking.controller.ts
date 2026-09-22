import type { Request, Response } from "express";

import {
  createAdminBookingNote,
  getAdminBookingById,
  getAdminBookings,
  updateAdminBooking,
  updateAdminBookingStatus,
} from "../../../services/booking/admin-booking.service.ts";

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
  if (error instanceof Error) {
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

export const HttpGetAdminBookings = async (req: Request, res: Response) => {
  try {
    const tenantId = requireTenantId(req);

    const bookings = await getAdminBookings({
      tenantId,
      query: req.query,
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
      actorLabel: getActorLabel(req),
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
      body: req.body?.body,
      actorLabel: getActorLabel(req),
    });

    res.status(201).json(note);
  } catch (error) {
    console.error("Failed to create admin booking note:", error);

    res.status(getErrorStatusCode(error)).json({
      error: getErrorMessage(error, "Failed to create booking note"),
    });
  }
};
