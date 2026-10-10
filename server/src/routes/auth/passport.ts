// routes/auth/passport.ts
import "dotenv/config";
import { Passport } from "passport";
import {
  AuthProviderType,
  PlatformRole,
  TenantRole,
} from "../../generated/prisma/client.js";
import { prisma } from "../../libs/prisma.js";
import {
  getUsableTenantById,
  isTenantUsable,
} from "../../services/tenant/tenant-domain.service.ts";

export const passport = new Passport();

export const config = {
  DEFAULT_CLIENT_URL:
    process.env.DEFAULT_CLIENT_URL ||
    process.env.CLIENT_URL ||
    "http://localhost:3000",

  COOKIE_KEY_1: process.env.COOKIE_KEY_1,
  COOKIE_KEY_2: process.env.COOKIE_KEY_2,
  COOKIE_MAX_AGE: Number(process.env.CLIENT_MAX_AGE || 1000 * 60 * 60 * 24 * 7),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
};

export type AuthenticatedUser = {
  // True for platform super admins acting inside a tenant.
  isPlatformAdmin?: boolean;
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


type Provider = "google" | "meta" | "x";

type ProviderInput = {
  // The tenant whose site started the login (from the verified OAuth state).
  tenantId: string;
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

/**
 * Platform super admins (User.platformRole = SUPER_ADMIN, set in the seed or
 * database, never from env) can sign in to and manage any tenant without a
 * membership. Inside a tenant they act with owner rights.
 */
export function isPlatformSuperAdmin(user: {
  platformRole?: PlatformRole | null;
}) {
  return user.platformRole === PlatformRole.SUPER_ADMIN;
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

// Login is always for one tenant: the one whose site started it.
// Super admins may also sign in to an inactive tenant (support).
async function getLoginTenant(
  tenantId: string,
  { allowInactive = false }: { allowInactive?: boolean } = {},
) {
  const tenant = allowInactive
    ? await prisma.tenant.findUnique({ where: { id: tenantId } })
    : await getUsableTenantById(tenantId);

  if (!tenant) {
    throw new Error("This business account isn't active.");
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

async function getExistingTenantMembership({
  userId,
  tenantId,
}: {
  userId: string;
  tenantId: string;
}) {
  return prisma.tenantMembership.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });
}

export async function findOrCreateAdminFromProvider({
  tenantId,
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

  const providerType = providerMap[provider];

  // Admin accounts are never created by logging in: they come from the seed
  // or from a tenant adding the person (membership).
  let user = await findUserByProviderOrEmail({
    providerType,
    providerId,
    email: normalizedEmail,
  });

  if (!user) {
    throw new Error("This email is not allowed to access the admin dashboard.");
  }

  if (!user.isActive) {
    throw new Error("This account is inactive.");
  }

  const superAdmin = isPlatformSuperAdmin(user);
  const tenant = await getLoginTenant(tenantId, { allowInactive: superAdmin });

  await linkAuthProvider({
    userId: user.id,
    providerType,
    providerId,
    email: normalizedEmail,
    username: username ?? null,
    name: name ?? null,
    picture: picture ?? null,
  });

  let role: TenantRole;

  if (superAdmin) {
    // No membership needed; owner rights in whichever tenant they're in.
    role = TenantRole.OWNER;
  } else {
    const membership = await getExistingTenantMembership({
      userId: user.id,
      tenantId: tenant.id,
    });

    if (!membership || !membership.isActive) {
      throw new Error("You don't have access to this business's dashboard.");
    }

    if (!isAdminRole(membership.role)) {
      throw new Error("You do not have admin access.");
    }

    role = membership.role;
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
    role,
    isPlatformAdmin: superAdmin,
    clientId: null,
    client: null,
    driver: null,
    worker: null,
  };
}

export async function findOrCreateClientFromProvider({
  tenantId,
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
  const tenant = await getLoginTenant(tenantId);

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
        platformRole: PlatformRole.USER,
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

      // A suspended/canceled tenant loses access on the next request.
      if (membership && !isTenantUsable(membership.tenant.status)) {
        membership = null;
      }

      tenant = membership?.tenant ?? null;

      // Super admins don't need a membership (any tenant, any status).
      if (isPlatformSuperAdmin(user)) {
        tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      }

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

    // Access comes from the database on every request, never from what was
    // saved in the session at login. A deactivated or deleted membership
    // loses tenant access immediately instead of when the cookie expires.
    const superAdmin = isPlatformSuperAdmin(user);
    const hasTenantAccess = Boolean(membership) || (superAdmin && tenant);

    done(null, {
      ...user,
      isPlatformAdmin: superAdmin,
      tenantId: hasTenantAccess ? (tenant?.id ?? null) : null,
      tenantSlug: hasTenantAccess ? (tenant?.slug ?? null) : null,
      role: superAdmin && tenant ? TenantRole.OWNER : (membership?.role ?? null),
      clientId: membership ? (client?.id ?? null) : null,
      client: membership ? client : null,
      driver: membership ? driver : null,
      worker: membership ? worker : null,
    });
  } catch (err) {
    done(err);
  }
});
