import { NoteVisibility, Prisma } from "../../generated/prisma/client.ts";
import { normalizeMoney } from "../../utils/money.utils.ts";

import {
  bookingNoteInclude,
  normalizeBookingNote,
} from "./booking-notes.service.ts";

export const bookingListInclude = {
  client: true,
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
} satisfies Prisma.BookingInclude;

export const bookingDetailInclude = {
  client: true,
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
    include: bookingNoteInclude,
    orderBy: {
      createdAt: "desc",
    },
  },
  history: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.BookingInclude;

export const publicBookingInclude = {
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
} satisfies Prisma.BookingInclude;

export function getPrimaryInventoryItem(booking: any) {
  return (
    booking.inventoryItems?.find((item: any) => item.role === "PRIMARY") ??
    booking.inventoryItems?.[0] ??
    null
  );
}

export function normalizeInventoryItemForBookingResponse(bookingItem: any) {
  if (!bookingItem) return null;

  const inventoryItem = bookingItem.inventoryItem;

  return {
    id: bookingItem.inventoryItemId,
    label: bookingItem.itemLabelSnapshot,
    category: bookingItem.itemCategorySnapshot,
    sizeValue: bookingItem.itemSizeValueSnapshot
      ? Number(bookingItem.itemSizeValueSnapshot)
      : null,
    sizeUnit: bookingItem.itemSizeUnitSnapshot,
    serialNumber: bookingItem.itemSerialSnapshot,

    basePrice: normalizeMoney(bookingItem.basePriceSnapshot),
    concretePrice: normalizeMoney(bookingItem.concretePriceSnapshot),

    primaryColor: inventoryItem?.primaryColor ?? null,
    secondaryColor: inventoryItem?.secondaryColor ?? null,
    colorPattern: inventoryItem?.colorPattern ?? null,
    status: inventoryItem?.status ?? null,
  };
}

export function normalizeBookingListItem(booking: any) {
  const primaryBookingItem = getPrimaryInventoryItem(booking);
  const inventoryItem =
    normalizeInventoryItemForBookingResponse(primaryBookingItem);

  return {
    id: booking.id,
    tenantId: booking.tenantId,
    bookingNumber: booking.bookingNumber,

    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,

    serviceType: booking.serviceType,
    projectType: booking.projectType,

    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,

    clientType: booking.clientType,
    businessName: booking.businessName,
    businessPhone: booking.businessPhone,
    businessEmail: booking.businessEmail,

    deliveryDate: booking.deliveryDate,
    pickupDate: booking.pickupDate,
    pickupDateUnknown: booking.pickupDateUnknown,

    address1: booking.address1,
    address2: booking.address2,
    city: booking.city,
    state: booking.state,
    zip: booking.zip,

    placement: booking.placement,

    fulfillmentType: booking.fulfillmentType,
    material: booking.material ?? null,

    basePrice: normalizeMoney(booking.basePrice),
    deliveryFee: normalizeMoney(booking.deliveryFee),
    billableMiles: normalizeMoney(booking.billableMiles),
    perMileRate: normalizeMoney(booking.perMileRate),
    mileageFee: normalizeMoney(booking.mileageFee),
    priorityDeliveryFee: normalizeMoney(booking.priorityDeliveryFee),
    extraDays: booking.extraDays ?? 0,
    extraDayRate: normalizeMoney(booking.extraDayRate),
    extraDaysFee: normalizeMoney(booking.extraDaysFee),
    materialFee: normalizeMoney(booking.materialFee),
    overageFee: normalizeMoney(booking.overageFee),
    addonsTotal: normalizeMoney(booking.addonsTotal),
    discountAmount: normalizeMoney(booking.discountAmount),
    discountReason: booking.discountReason ?? null,
    subtotal: normalizeMoney(booking.subtotal),
    taxRate: booking.taxRate == null ? 0 : Number(booking.taxRate),
    taxAmount: normalizeMoney(booking.taxAmount),
    total: normalizeMoney(booking.total),

    inventoryItem,
    inventoryItems: booking.inventoryItems ?? [],

    // Temporary old frontend aliases.
    dumpster: inventoryItem,
    dumpsterId: inventoryItem?.id ?? null,
    dumpsterLabel: inventoryItem?.label ?? null,
    dumpsterSize: inventoryItem?.sizeValue ?? null,

    addons: booking.addons ?? [],

    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

// viewerUserId marks which notes are unread for the person asking.
export function normalizeBookingDetail(
  booking: any,
  viewerUserId?: string | null,
) {
  const notes = (booking.notes ?? []).map((note: any) =>
    normalizeBookingNote(note, viewerUserId),
  );

  return {
    ...normalizeBookingListItem(booking),

    rentalDaysIncluded: booking.rentalDaysIncluded,
    source: booking.source,
    createdByUserId: booking.createdByUserId ?? null,

    instructions: booking.instructions,
    customerNotes: booking.customerNotes,

    locationVerified: booking.locationVerified,
    locationVerificationNote: booking.locationVerificationNote,

    priorityDelivery: booking.priorityDelivery,
    deliveryTime: booking.deliveryTime,
    priorityDeliveryNote: booking.priorityDeliveryNote,

    stripePaymentIntentId: booking.stripePaymentIntentId,
    stripePaymentStatus: booking.stripePaymentStatus,

    paidAt: booking.paidAt,
    confirmedAt: booking.confirmedAt,
    quotedAt: booking.quotedAt,
    scheduledAt: booking.scheduledAt,
    deliveredAt: booking.deliveredAt,
    pickedUpAt: booking.pickedUpAt,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason ?? null,
    completedAt: booking.completedAt,

    client: booking.client,
    notes,
    history: booking.history ?? [],

    unreadNoteCount: notes.filter((note: any) => note.isUnread).length,
    openRequestCount: notes.filter(
      (note: any) => note.requestStatus === "OPEN",
    ).length,
  };
}

export const normalizeBookingResponse = normalizeBookingDetail;
export const bookingInclude = publicBookingInclude;
