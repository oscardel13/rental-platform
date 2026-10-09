import { prisma } from "../../libs/prisma.ts";
import {
  AuthProviderType,
  BookingActorType,
  ClientType,
  NoteVisibility,
  PlatformRole,
  TenantRole,
} from "../../generated/prisma/client.ts";
import {
  bookingNoteInclude,
  createCustomerBookingNote,
  createCustomerChangeRequest,
  createCustomerRescheduleRequest,
  getBookingNoteCounts,
  markBookingNotesRead,
  normalizeBookingNote,
  previewBookingReschedule,
} from "../booking/booking-notes.service.ts";

type RequestUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  picture?: string | null;

  platformRole?: PlatformRole;
  tenantId?: string | null;
  tenantSlug?: string | null;
  role?: TenantRole | null;
  clientId?: string | null;

  isActive?: boolean;

  client?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
    clientType?: string | null;
    businessName?: string | null;
  } | null;
};

const DEFAULT_TENANT_SLUG =
  process.env.DEFAULT_TENANT_SLUG || "iron-peak-services";

function createServiceError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone?: string | null) {
  return phone?.replace(/\D/g, "") || null;
}

function safeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    picture: user.picture,
    platformRole: user.platformRole,
    isActive: user.isActive,
  };
}

function isAdminOrOwner(requestUser?: RequestUser | null) {
  return (
    requestUser?.role === TenantRole.ADMIN ||
    requestUser?.role === TenantRole.OWNER ||
    requestUser?.platformRole === PlatformRole.SUPER_ADMIN
  );
}

function getActorLabel(requestUser?: RequestUser | null) {
  return (
    requestUser?.client?.displayName ||
    requestUser?.name ||
    requestUser?.email ||
    "Client"
  );
}

function getTenantIdOrThrow(requestUser?: RequestUser | null) {
  const tenantId = requestUser?.tenantId;

  if (!tenantId) {
    throw createServiceError("Tenant access is required.", 403);
  }

  return tenantId;
}

function getClientAccessFilter(requestUser?: RequestUser | null) {
  const clientId = requestUser?.clientId ?? requestUser?.client?.id ?? null;
  const email = normalizeEmail(requestUser?.email);

  const ownershipFilters = [
    ...(clientId ? [{ clientId }] : []),
    ...(email ? [{ customerEmail: email }] : []),
  ];

  return {
    clientId,
    email,
    ownershipFilters,
  };
}

function getClientNoteVisibility() {
  return NoteVisibility.CUSTOMER;
}

function normalizeMoney(value: unknown) {
  return Number(value || 0);
}

function getPrimaryInventoryItem(booking: any) {
  return (
    booking.inventoryItems?.find((item: any) => item.role === "PRIMARY") ??
    booking.inventoryItems?.[0] ??
    null
  );
}

function normalizeInventoryItemForOldFrontend(bookingItem: any) {
  if (!bookingItem) return null;

  const inventoryItem = bookingItem.inventoryItem;

  return {
    id: bookingItem.inventoryItemId,
    label: bookingItem.itemLabelSnapshot,
    size: bookingItem.itemSizeValueSnapshot
      ? Number(bookingItem.itemSizeValueSnapshot)
      : null,
    sizeValue: bookingItem.itemSizeValueSnapshot
      ? Number(bookingItem.itemSizeValueSnapshot)
      : null,
    sizeUnit: bookingItem.itemSizeUnitSnapshot,
    serialNumber: bookingItem.itemSerialSnapshot,

    category: bookingItem.itemCategorySnapshot,

    primaryColor: inventoryItem?.primaryColor ?? null,
    secondaryColor: inventoryItem?.secondaryColor ?? null,
    colorPattern: inventoryItem?.colorPattern ?? null,
    status: inventoryItem?.status ?? null,
    isActive: inventoryItem?.isActive ?? null,

    basePrice: normalizeMoney(bookingItem.basePriceSnapshot),
    concretePrice: normalizeMoney(bookingItem.concretePriceSnapshot),
  };
}

function normalizeBookingListItem(booking: any) {
  const primaryBookingItem = getPrimaryInventoryItem(booking);
  const normalizedInventoryItem =
    normalizeInventoryItemForOldFrontend(primaryBookingItem);

  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,

    tenantId: booking.tenantId,

    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,

    deliveryDate: booking.deliveryDate,
    pickupDate: booking.pickupDate,
    pickupDateUnknown: booking.pickupDateUnknown,

    address1: booking.address1,
    address2: booking.address2,
    city: booking.city,
    state: booking.state,
    zip: booking.zip,

    // Temporary compatibility fields for old frontend components.
    dumpsterId: primaryBookingItem?.inventoryItemId ?? null,
    dumpsterLabel: primaryBookingItem?.itemLabelSnapshot ?? null,
    dumpsterSize: primaryBookingItem?.itemSizeValueSnapshot
      ? Number(primaryBookingItem.itemSizeValueSnapshot)
      : null,

    inventoryItemId: primaryBookingItem?.inventoryItemId ?? null,
    inventoryLabel: primaryBookingItem?.itemLabelSnapshot ?? null,
    inventorySize: primaryBookingItem?.itemSizeValueSnapshot
      ? Number(primaryBookingItem.itemSizeValueSnapshot)
      : null,
    inventoryItems: booking.inventoryItems ?? [],

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

    // Receipts are dated by payment, so the list needs these too.
    paidAt: booking.paidAt,
    completedAt: booking.completedAt,

    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,

    // Temporary compatibility alias.
    dumpster: normalizedInventoryItem,

    addons: booking.addons,
  };
}

function normalizeBookingDetail(booking: any) {
  return {
    ...normalizeBookingListItem(booking),

    serviceType: booking.serviceType,
    projectType: booking.projectType,

    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail,

    clientType: booking.clientType,
    businessName: booking.businessName,
    businessPhone: booking.businessPhone,
    businessEmail: booking.businessEmail,

    rentalDaysIncluded: booking.rentalDaysIncluded,

    instructions: booking.instructions,
    customerNotes: booking.customerNotes,
    locationVerified: booking.locationVerified,
    locationVerificationNote: booking.locationVerificationNote,

    priorityDelivery: booking.priorityDelivery,
    deliveryTime: booking.deliveryTime,
    priorityDeliveryNote: booking.priorityDeliveryNote,

    notes: booking.notes,

    paidAt: booking.paidAt,
    confirmedAt: booking.confirmedAt,
    scheduledAt: booking.scheduledAt,
    deliveredAt: booking.deliveredAt,
    pickedUpAt: booking.pickedUpAt,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason ?? null,
    completedAt: booking.completedAt,
  };
}

async function getDefaultTenant() {
  const tenant = await prisma.tenant.findUnique({
    where: {
      slug: DEFAULT_TENANT_SLUG,
    },
  });

  if (!tenant) {
    throw createServiceError(
      `Tenant "${DEFAULT_TENANT_SLUG}" was not found.`,
      500,
    );
  }

  return tenant;
}

async function getOrCreateClientMembership({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  const existingMembership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (existingMembership) {
    if (!existingMembership.isActive) {
      throw createServiceError("This tenant membership is inactive.", 403);
    }

    return existingMembership;
  }

  return prisma.tenantMembership.create({
    data: {
      user: {
        connect: {
          id: userId,
        },
      },
      tenant: {
        connect: {
          id: tenantId,
        },
      },
      role: TenantRole.CLIENT,
      isActive: true,
    },
  });
}

async function getOrCreateClientProfile({
  userId,
  tenantId,
  name,
  email,
  phone,
}: {
  userId: string;
  tenantId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const existingClient = await prisma.client.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId,
      },
    },
  });

  if (existingClient) {
    return existingClient;
  }

  return prisma.client.create({
    data: {
      tenant: {
        connect: {
          id: tenantId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      clientType: ClientType.INDIVIDUAL,
      displayName: name ?? null,
      email: email ?? null,
      phone: phone ?? null,
    },
  });
}

async function getClientOwnedBookingOrThrow(
  bookingId: string,
  requestUser?: RequestUser | null,
) {
  if (!bookingId) {
    throw createServiceError("Booking ID is required.", 400);
  }

  const tenantId = getTenantIdOrThrow(requestUser);
  const { ownershipFilters } = getClientAccessFilter(requestUser);

  if (!isAdminOrOwner(requestUser) && ownershipFilters.length === 0) {
    throw createServiceError("Client profile is required.", 403);
  }

  const booking = await prisma.booking.findFirst({
    where: isAdminOrOwner(requestUser)
      ? {
          id: bookingId,
          tenantId,
        }
      : {
          id: bookingId,
          tenantId,
          OR: ownershipFilters,
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
          visibility: getClientNoteVisibility(),
        },
        include: bookingNoteInclude,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!booking) {
    throw createServiceError("Booking not found.", 404);
  }

  return booking;
}

export async function createClientAccount(data: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  picture?: string | null;
  provider?: AuthProviderType;
  providerAccountId?: string | null;
  username?: string | null;
}) {
  const tenant = await getDefaultTenant();

  const name = data.name?.trim() || null;
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  const picture = data.picture || null;
  const username = data.username || null;
  const provider = data.provider ?? AuthProviderType.EMAIL;
  const providerAccountId = data.providerAccountId?.trim() || null;

  if (!email) {
    throw createServiceError("Email is required.", 400);
  }

  let user = await prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      authProviders: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        picture,
        platformRole: PlatformRole.USER,
        isActive: true,
        ...(providerAccountId
          ? {
              authProviders: {
                create: {
                  provider,
                  providerAccountId,
                  email,
                  username,
                  name,
                  picture,
                },
              },
            }
          : {}),
      },
      include: {
        authProviders: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        phone: user.phone || phone,
        picture: user.picture || picture,
      },
      include: {
        authProviders: true,
      },
    });
  }

  if (!user.isActive) {
    throw createServiceError("This account is inactive.", 403);
  }

  const existingClient = await prisma.client.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
  });

  if (existingClient) {
    throw createServiceError("An account with this email already exists.", 409);
  }

  await getOrCreateClientMembership({
    userId: user.id,
    tenantId: tenant.id,
  });

  if (providerAccountId) {
    await prisma.userAuthProvider.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      update: {
        userId: user.id,
        email,
        username,
        name: user.name || name,
        picture,
      },
      create: {
        userId: user.id,
        provider,
        providerAccountId,
        email,
        username,
        name: user.name || name,
        picture,
      },
    });
  }

  const client = await getOrCreateClientProfile({
    userId: user.id,
    tenantId: tenant.id,
    name: user.name || name,
    email: user.email || email,
    phone: user.phone || phone,
  });

  return {
    user: safeUser(user),
    client,
  };
}

export async function getOrCreateClientForUser(userId: string) {
  const tenant = await getDefaultTenant();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw createServiceError("User not found.", 404);
  }

  await getOrCreateClientMembership({
    userId: user.id,
    tenantId: tenant.id,
  });

  return getOrCreateClientProfile({
    userId: user.id,
    tenantId: tenant.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  });
}

export async function getClientBookings(requestUser?: RequestUser | null) {
  const tenantId = getTenantIdOrThrow(requestUser);
  const { ownershipFilters } = getClientAccessFilter(requestUser);

  if (!isAdminOrOwner(requestUser) && ownershipFilters.length === 0) {
    throw createServiceError("Client profile is required.", 403);
  }

  const bookings = await prisma.booking.findMany({
    where: isAdminOrOwner(requestUser)
      ? {
          tenantId,
        }
      : {
          tenantId,
          OR: ownershipFilters,
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
    },
    orderBy: [
      {
        deliveryDate: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  // Flags bookings with staff replies this customer hasn't read.
  const noteCounts = await getBookingNoteCounts({
    tenantId,
    bookingIds: bookings.map((booking) => booking.id),
    viewerUserId: requestUser?.id ?? null,
    audience: "CUSTOMER",
  });

  return bookings.map((booking) => ({
    ...normalizeBookingListItem(booking),
    unreadNoteCount: noteCounts.get(booking.id)?.unreadNoteCount ?? 0,
  }));
}

export async function getClientBookingById(
  bookingId: string,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);
  const viewerUserId = requestUser?.id ?? null;
  const detail = normalizeBookingDetail(booking);
  const notes = (booking.notes ?? []).map((note: any) => {
    const normalized = normalizeBookingNote(note, viewerUserId);

    // Customers don't see which staff member read what.
    return { ...normalized, views: [] };
  });

  return {
    ...detail,
    notes,
    unreadNoteCount: notes.filter((note: any) => note.isUnread).length,
  };
}

export async function markClientBookingNotesRead(
  bookingId: string,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  if (!requestUser?.id) return { marked: 0 };

  const marked = await markBookingNotesRead({
    tenantId: booking.tenantId,
    bookingId: booking.id,
    userId: requestUser.id,
    customerOnly: true,
  });

  return { marked };
}

export async function previewClientBookingReschedule(
  bookingId: string,
  query: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  return previewBookingReschedule({
    tenantId: booking.tenantId,
    bookingId: booking.id,
    input: {
      deliveryDate: query?.deliveryDate,
      pickupDate: query?.pickupDate,
      pickupDateUnknown:
        query?.pickupDateUnknown === true || query?.pickupDateUnknown === "true",
    },
  });
}

export async function createClientBookingRescheduleRequest(
  bookingId: string,
  data: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  return createCustomerRescheduleRequest({
    tenantId: booking.tenantId,
    bookingId: booking.id,
    userId: requestUser?.id ?? null,
    actorLabel: getActorLabel(requestUser),
    input: {
      deliveryDate: data?.deliveryDate,
      pickupDate: data?.pickupDate,
      pickupDateUnknown: data?.pickupDateUnknown,
    },
    message: data?.message,
  });
}

export async function createClientBookingNote(
  bookingId: string,
  data: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  return createCustomerBookingNote({
    tenantId: booking.tenantId,
    bookingId: booking.id,
    userId: requestUser?.id ?? null,
    actorLabel: getActorLabel(requestUser),
    title: data?.title,
    body: data?.body,
  });
}

// Anything other than new dates (those use the reschedule request).
export async function createClientBookingChangeRequest(
  bookingId: string,
  data: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  return createCustomerChangeRequest({
    tenantId: booking.tenantId,
    bookingId: booking.id,
    userId: requestUser?.id ?? null,
    actorLabel: getActorLabel(requestUser),
    type: data?.type,
    message: data?.message,
  });
}
