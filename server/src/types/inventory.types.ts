// src/types/inventory.types.ts

export type InventoryAvailabilityDay = {
  date: string;

  availableCount: number;
  startableCount: number;
  sevenDayAvailableCount: number;

  totalCount: number;
  maxRentalDays: number;
  defaultRentalDays: number;

  hasSevenDayAvailability: boolean;
  status: "UNAVAILABLE" | "LIMITED" | "AVAILABLE_7_PLUS";

  availableItemIds: string[];
  startableItemIds: string[];
  sevenDayAvailableItemIds: string[];
};

export type InventoryAvailabilitySummary = {
  totalInventoryItems: number;
  totalAvailableItems: number;
  startDate: string;
  requestedRentalDays: number;
  maxRentalDaysLimit: number;
  days: InventoryAvailabilityDay[];
};

export type InventoryDateAvailabilityQuery = {
  startDate?: string;
  deliveryDate?: string;
  days?: string | number;
  rentalDays?: string | number;
  maxRentalDays?: string | number;
};
