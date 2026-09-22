import { prisma } from "../../libs/prisma.ts";
import {
  AuthProviderType,
  BookingActorType,
  ClientType,
  NoteVisibility,
  PlatformRole,
  TenantRole,
} from "../../generated/prisma/client.ts";

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
    material: null,

    inventoryItemId: primaryBookingItem?.inventoryItemId ?? null,
    inventoryLabel: primaryBookingItem?.itemLabelSnapshot ?? null,
    inventorySize: primaryBookingItem?.itemSizeValueSnapshot
      ? Number(primaryBookingItem.itemSizeValueSnapshot)
      : null,
    inventoryItems: booking.inventoryItems ?? [],

    placement: booking.placement,

    basePrice: normalizeMoney(booking.basePrice),
    deliveryFee: normalizeMoney(booking.deliveryFee),
    mileageFee: normalizeMoney(booking.mileageFee),
    extraDaysFee: normalizeMoney(booking.extraDaysFee),
    overageFee: normalizeMoney(booking.overageFee),
    addonsTotal: normalizeMoney(booking.addonsTotal),
    total: normalizeMoney(booking.total),

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

  return bookings.map(normalizeBookingListItem);
}

export async function getClientBookingById(
  bookingId: string,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  return normalizeBookingDetail(booking);
}

export async function createClientBookingNote(
  bookingId: string,
  data: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);
  const body = String(data?.body || "").trim();

  if (!body) {
    throw createServiceError("Note body is required.", 400);
  }

  const note = await prisma.bookingNote.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      visibility: getClientNoteVisibility(),
      body,
    },
  });

  await prisma.bookingHistory.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      eventType: "CLIENT_NOTE_CREATED",
      actorType: BookingActorType.CLIENT,
      actorLabel: getActorLabel(requestUser),
      summary: "Client added a note.",
      metadata: {
        noteId: note.id,
      },
    },
  });

  return note;
}

export async function createClientBookingChangeRequest(
  bookingId: string,
  data: any,
  requestUser?: RequestUser | null,
) {
  const booking = await getClientOwnedBookingOrThrow(bookingId, requestUser);

  const type = String(data?.type || "GENERAL")
    .trim()
    .toUpperCase();
  const message = String(data?.message || "").trim();

  if (!message) {
    throw createServiceError("Change request message is required.", 400);
  }

  const requestedDeliveryDate = data?.requestedDeliveryDate || null;
  const requestedPickupDate = data?.requestedPickupDate || null;

  const noteBody = [
    `Change request: ${type}`,
    message,
    requestedDeliveryDate
      ? `Requested delivery date: ${requestedDeliveryDate}`
      : null,
    requestedPickupDate
      ? `Requested pickup date: ${requestedPickupDate}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const note = await prisma.bookingNote.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      visibility: getClientNoteVisibility(),
      body: noteBody,
    },
  });

  const history = await prisma.bookingHistory.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      eventType: "CLIENT_CHANGE_REQUESTED",
      actorType: BookingActorType.CLIENT,
      actorLabel: getActorLabel(requestUser),
      summary: `Client requested a booking change: ${type}.`,
      metadata: {
        type,
        message,
        requestedDeliveryDate,
        requestedPickupDate,
        noteId: note.id,
      },
    },
  });

  return {
    type,
    message,
    requestedDeliveryDate,
    requestedPickupDate,
    note,
    history,
  };
}
