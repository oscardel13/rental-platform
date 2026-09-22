// routes/auth/passport.ts
import "dotenv/config";
import { Passport } from "passport";
import {
  AuthProviderType,
  PlatformRole,
  TenantRole,
} from "../../generated/prisma/client.js";
import { prisma } from "../../libs/prisma.js";

export const passport = new Passport();

export const config = {
  API_URL: process.env.API_URL || "",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  COOKIE_KEY_1: process.env.COOKIE_KEY_1,
  COOKIE_KEY_2: process.env.COOKIE_KEY_2,
  COOKIE_MAX_AGE: Number(process.env.CLIENT_MAX_AGE || 1000 * 60 * 60 * 24 * 7),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
};

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  name?: string | null;
  phone?: string | null;
  picture?: string | null;

  platformRole: PlatformRole;
  isActive?: boolean;
  lastLoginAt?: Date | null;

  tenantId: string | null;
  tenantSlug: string | null;
  role: TenantRole | null;

  clientId: string | null;
  client?: unknown | null;
  driver?: unknown | null;
  worker?: unknown | null;
};

const DEFAULT_TENANT_SLUG =
  process.env.DEFAULT_TENANT_SLUG || "iron-peak-services";

type Provider = "google" | "meta" | "x";

type ProviderInput = {
  provider: Provider;
  providerId: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
  username?: string | null;
};

const providerMap: Record<Provider, AuthProviderType> = {
  google: AuthProviderType.GOOGLE,
  meta: AuthProviderType.META,
  x: AuthProviderType.X,
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function getEmailsFromEnv(value?: string) {
  return String(value || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean) as string[];
}

const SUPER_ADMIN_EMAILS = new Set(
  getEmailsFromEnv(process.env.SUPER_ADMIN_EMAILS),
);

const OWNER_EMAILS = new Set(getEmailsFromEnv(process.env.OWNER_EMAILS));
const ADMIN_EMAILS = new Set(getEmailsFromEnv(process.env.ADMIN_EMAILS));

function getAllowedTenantRole(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return null;

  if (SUPER_ADMIN_EMAILS.has(normalizedEmail)) return TenantRole.OWNER;
  if (OWNER_EMAILS.has(normalizedEmail)) return TenantRole.OWNER;
  if (ADMIN_EMAILS.has(normalizedEmail)) return TenantRole.ADMIN;

  return null;
}

function getPlatformRole(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) return PlatformRole.USER;

  if (SUPER_ADMIN_EMAILS.has(normalizedEmail)) {
    return PlatformRole.SUPER_ADMIN;
  }

  return PlatformRole.USER;
}

function isAdminRole(role: TenantRole) {
  return role === TenantRole.OWNER || role === TenantRole.ADMIN;
}

function getStrongestTenantRole(
  existingRole: TenantRole,
  requestedRole: TenantRole,
) {
  const rank: Record<TenantRole, number> = {
    [TenantRole.CLIENT]: 1,
    [TenantRole.WORKER]: 2,
    [TenantRole.DRIVER]: 3,
    [TenantRole.DISPATCHER]: 4,
    [TenantRole.ADMIN]: 5,
    [TenantRole.OWNER]: 6,
  };

  return rank[existingRole] >= rank[requestedRole]
    ? existingRole
    : requestedRole;
}

async function getDefaultTenant() {
  const tenant = await prisma.tenant.findUnique({
    where: {
      slug: DEFAULT_TENANT_SLUG,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant "${DEFAULT_TENANT_SLUG}" was not found.`);
  }

  return tenant;
}

async function findUserByProviderOrEmail({
  providerType,
  providerId,
  email,
}: {
  providerType: AuthProviderType;
  providerId: string;
  email: string;
}) {
  let user = await prisma.user.findFirst({
    where: {
      isActive: true,
      authProviders: {
        some: {
          provider: providerType,
          providerAccountId: providerId,
        },
      },
    },
    include: {
      authProviders: true,
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        email,
      },
      include: {
        authProviders: true,
      },
    });
  }

  return user;
}

async function linkAuthProvider({
  userId,
  providerType,
  providerId,
  email,
  username,
  name,
  picture,
}: {
  userId: string;
  providerType: AuthProviderType;
  providerId: string;
  email: string;
  username: string | null;
  name: string | null;
  picture: string | null;
}) {
  await prisma.userAuthProvider.upsert({
    where: {
      provider_providerAccountId: {
        provider: providerType,
        providerAccountId: providerId,
      },
    },
    update: {
      email,
      username,
      name,
      picture,
    },
    create: {
      userId,
      provider: providerType,
      providerAccountId: providerId,
      email,
      username,
      name,
      picture,
    },
  });
}

async function upsertTenantMembership({
  userId,
  tenantId,
  role,
}: {
  userId: string;
  tenantId: string;
  role: TenantRole;
}) {
  return prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    update: {
      role,
      isActive: true,
    },
    create: {
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
      role,
      isActive: true,
    },
  });
}

async function findOrCreateClientForTenant({
  userId,
  tenantId,
  email,
  name,
  phone,
}: {
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
  phone: string | null;
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
      displayName: name,
      email,
      phone,
    },
  });
}

export async function findOrCreateAdminFromProvider({
  provider,
  providerId,
  email,
  name,
  picture,
  username,
}: ProviderInput): Promise<AuthenticatedUser> {
  if (!providerId) {
    throw new Error(`Missing providerId for ${provider}`);
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required for admin login.");
  }

  const allowedTenantRole = getAllowedTenantRole(normalizedEmail);

  if (!allowedTenantRole) {
    throw new Error("This email is not allowed to access the admin dashboard.");
  }

  const providerType = providerMap[provider];
  const tenant = await getDefaultTenant();

  let user = await findUserByProviderOrEmail({
    providerType,
    providerId,
    email: normalizedEmail,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name ?? null,
        picture: picture ?? null,
        platformRole: getPlatformRole(normalizedEmail),
        isActive: true,
        lastLoginAt: new Date(),
        authProviders: {
          create: {
            provider: providerType,
            providerAccountId: providerId,
            email: normalizedEmail,
            username: username ?? null,
            name: name ?? null,
            picture: picture ?? null,
          },
        },
      },
      include: {
        authProviders: true,
      },
    });
  }

  if (!user.isActive) {
    throw new Error("This account is inactive.");
  }

  const platformRole = getPlatformRole(normalizedEmail);

  if (user.platformRole !== platformRole) {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        platformRole,
      },
      include: {
        authProviders: true,
      },
    });
  }

  await linkAuthProvider({
    userId: user.id,
    providerType,
    providerId,
    email: normalizedEmail,
    username: username ?? null,
    name: name ?? null,
    picture: picture ?? null,
  });

  const membership = await upsertTenantMembership({
    userId: user.id,
    tenantId: tenant.id,
    role: allowedTenantRole,
  });

  if (!isAdminRole(membership.role)) {
    throw new Error("You do not have admin access.");
  }

  user = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: user.name ?? name ?? null,
      picture: user.picture ?? picture ?? null,
      lastLoginAt: new Date(),
    },
    include: {
      authProviders: true,
    },
  });

  return {
    ...user,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    role: membership.role,
    clientId: null,
    client: null,
    driver: null,
    worker: null,
  };
}

export async function findOrCreateClientFromProvider({
  provider,
  providerId,
  email,
  name,
  picture,
  username,
}: ProviderInput): Promise<AuthenticatedUser> {
  if (!providerId) {
    throw new Error(`Missing providerId for ${provider}`);
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required for client login.");
  }

  const providerType = providerMap[provider];
  const tenant = await getDefaultTenant();

  let user = await findUserByProviderOrEmail({
    providerType,
    providerId,
    email: normalizedEmail,
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name ?? null,
        picture: picture ?? null,
        platformRole: getPlatformRole(normalizedEmail),
        isActive: true,
        lastLoginAt: new Date(),
        authProviders: {
          create: {
            provider: providerType,
            providerAccountId: providerId,
            email: normalizedEmail,
            username: username ?? null,
            name: name ?? null,
            picture: picture ?? null,
          },
        },
      },
      include: {
        authProviders: true,
      },
    });
  }

  if (!user.isActive) {
    throw new Error("This account is inactive.");
  }

  const platformRole = getPlatformRole(normalizedEmail);

  if (user.platformRole !== platformRole) {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        platformRole,
      },
      include: {
        authProviders: true,
      },
    });
  }

  await linkAuthProvider({
    userId: user.id,
    providerType,
    providerId,
    email: normalizedEmail,
    username: username ?? null,
    name: name ?? null,
    picture: picture ?? null,
  });

  const existingMembership = await prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
  });

  let membership = existingMembership;

  if (!membership) {
    membership = await prisma.tenantMembership.create({
      data: {
        user: {
          connect: {
            id: user.id,
          },
        },
        tenant: {
          connect: {
            id: tenant.id,
          },
        },
        role: TenantRole.CLIENT,
        isActive: true,
      },
    });
  } else if (!membership.isActive) {
    throw new Error("This tenant membership is inactive.");
  } else {
    const strongestRole = getStrongestTenantRole(
      membership.role,
      TenantRole.CLIENT,
    );

    if (membership.role !== strongestRole) {
      membership = await prisma.tenantMembership.update({
        where: {
          id: membership.id,
        },
        data: {
          role: strongestRole,
        },
      });
    }
  }

  const client = await findOrCreateClientForTenant({
    userId: user.id,
    tenantId: tenant.id,
    email: normalizedEmail,
    name: user.name ?? name ?? null,
    phone: user.phone ?? null,
  });

  user = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      name: user.name ?? name ?? null,
      picture: user.picture ?? picture ?? null,
      lastLoginAt: new Date(),
    },
    include: {
      authProviders: true,
    },
  });

  return {
    ...user,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    role: membership.role,
    clientId: client.id,
    client,
    driver: null,
    worker: null,
  };
}

passport.serializeUser((user: Express.User, done) => {
  done(null, {
    id: user.id,
    email: user.email,
    platformRole: user.platformRole,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    role: user.role,
    clientId: user.clientId ?? null,
  });
});

passport.deserializeUser(async (sessionUser: any, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: sessionUser.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        picture: true,
        platformRole: true,
        isActive: true,
        lastLoginAt: true,
      },
    });

    if (!user || !user.isActive) {
      return done(null, false);
    }

    const tenantId = sessionUser.tenantId as string | undefined;

    let membership = null;
    let tenant = null;
    let client = null;
    let driver = null;
    let worker = null;

    if (tenantId) {
      membership = await prisma.tenantMembership.findFirst({
        where: {
          userId: user.id,
          tenantId,
          isActive: true,
        },
        include: {
          tenant: true,
        },
      });

      tenant = membership?.tenant ?? null;

      client = await prisma.client.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          clientType: true,
          businessName: true,
        },
      });

      driver = await prisma.driver.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      worker = await prisma.worker.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
        select: {
          id: true,
          isActive: true,
        },
      });
    }

    done(null, {
      ...user,
      tenantId: tenant?.id ?? tenantId ?? null,
      tenantSlug: tenant?.slug ?? sessionUser.tenantSlug ?? null,
      role: membership?.role ?? sessionUser.role ?? null,
      clientId: client?.id ?? sessionUser.clientId ?? null,
      client,
      driver,
      worker,
    });
  } catch (err) {
    done(err);
  }
});
