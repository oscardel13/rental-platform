// routes/client/client.controller.ts
import type { Request, Response } from "express";
import {
  createClientBookingChangeRequest,
  createClientBookingNote,
  getClientBookingById,
  getClientBookings,
} from "../../services/client/client.service.ts";

function getHttpErrorStatus(error: unknown) {
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

function getHttpErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function getRequestUser(req: Request) {
  return req.user as any;
}

function getRouteId(req: Request) {
  const rawId = req.params.id;
  return Array.isArray(rawId) ? rawId[0] : rawId;
}

// GET /client/me
export async function HttpGetClientMe(req: Request, res: Response) {
  try {
    const user = getRequestUser(req);

    res.status(200).json({
      user,
      client: user?.client ?? null,
    });
  } catch (error) {
    console.error("Error getting client me:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(error, "Failed to get client profile."),
    });
  }
}

// GET /client/bookings
export async function HttpGetClientBookings(req: Request, res: Response) {
  try {
    const user = getRequestUser(req);

    const bookings = await getClientBookings(user);

    res.status(200).json({
      bookings,
    });
  } catch (error) {
    console.error("Error getting client bookings:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(error, "Failed to get client bookings."),
    });
  }
}

// GET /client/bookings/:id
export async function HttpGetClientBookingById(req: Request, res: Response) {
  try {
    const user = getRequestUser(req);
    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required.",
      });
    }

    const booking = await getClientBookingById(id, user);

    res.status(200).json({
      booking,
    });
  } catch (error) {
    console.error("Error getting client booking:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(error, "Failed to get client booking."),
    });
  }
}

// POST /client/bookings/:id/notes
export async function HttpCreateClientBookingNote(req: Request, res: Response) {
  try {
    const user = getRequestUser(req);
    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required.",
      });
    }

    const note = await createClientBookingNote(id, req.body, user);

    res.status(201).json({
      note,
    });
  } catch (error) {
    console.error("Error creating client booking note:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(error, "Failed to create booking note."),
    });
  }
}

// POST /client/bookings/:id/change-request
export async function HttpCreateClientBookingChangeRequest(
  req: Request,
  res: Response,
) {
  try {
    const user = getRequestUser(req);
    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        error: "Booking ID is required.",
      });
    }

    const changeRequest = await createClientBookingChangeRequest(
      id,
      req.body,
      user,
    );

    res.status(201).json({
      changeRequest,
    });
  } catch (error) {
    console.error("Error creating client booking change request:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(
        error,
        "Failed to create booking change request.",
      ),
    });
  }
}

// GET /client/:id
export async function HttpGetClientById(req: Request, res: Response) {
  try {
    const id = getRouteId(req);

    if (!id) {
      return res.status(400).json({
        error: "Client ID is required.",
      });
    }

    res.status(200).json({
      message: "Admin client detail route working.",
      clientId: id,
      client: null,
    });
  } catch (error) {
    console.error("Error getting client by id:", error);

    res.status(getHttpErrorStatus(error)).json({
      error: getHttpErrorMessage(error, "Failed to get client."),
    });
  }
}
