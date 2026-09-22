// src/types/booking.types.ts

import type {
  BookingStatus,
  ClientType,
  PaymentStatus,
  Prisma,
  ServiceType,
} from "../generated/prisma/client.js";

export type SelectedAddonInput = {
  addonId: string | null;
  code: string | null;
  quantity: number;
};

export type SelectedAddon = {
  addon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: number | string | Prisma.Decimal | null;
  };
  quantity: number;
};

export type ValidatedPublicBookingData = {
  inventoryItemId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  deliveryDate: Date;
  pickupDate: Date | null;
  pickupDateUnknown: boolean;
};

export type CreatePublicBookingInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

export type CreatePublicBookingQuoteInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

export type CreatePublicBookingCheckoutDraftInput = {
  tenantId: string;
  tenantTimezone: string;
  data: any;
};

export type UpdatePublicBookingCheckoutDraftInput = {
  tenantId: string;
  tenantTimezone: string;
  bookingId: string;
  data: any;
};

export type GetPublicBookingStatusInput = {
  tenantId: string;
  bookingNumber: string;
  email: string;
};

export type BookingPricingInput = {
  inventoryItem: any;
  selectedAddons: SelectedAddon[];
  data: any;
  deliveryDate: Date;
  pickupDate: Date | null;
};

export type BookingPricingResult = {
  rentalDaysIncluded: number;
  actualRentalDays: number;
  basePrice: number;
  deliveryFee: number;
  mileageFee: number;
  extraDaysFee: number;
  overageFee: number;
  addonsTotal: number;
  total: number;
};

export type BookingCreateStatusInput = {
  bookingStatus?: BookingStatus;
  paymentStatus?: PaymentStatus;
  serviceType?: ServiceType;
  clientType?: ClientType;
};
