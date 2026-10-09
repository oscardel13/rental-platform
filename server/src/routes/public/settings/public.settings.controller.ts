import type { Request, Response } from "express";

import { getPublicBookingSettings } from "../../../services/booking/booking-pricing.service.ts";
import { getPublicTenantId } from "../public.tenant.helper.ts";

export const HttpGetPublicBookingSettings = async (
  req: Request,
  res: Response,
) => {
  try {
    const tenantId = await getPublicTenantId(req);

    if (!tenantId) {
      return res.status(404).json({
        error: "Tenant not found",
      });
    }

    const settings = await getPublicBookingSettings(tenantId);

    res.json(settings);
  } catch (error) {
    console.error("Failed to fetch public booking settings:", error);

    res.status(500).json({
      error: "Failed to fetch booking settings",
    });
  }
};
