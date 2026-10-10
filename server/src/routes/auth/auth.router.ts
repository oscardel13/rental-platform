import "dotenv/config";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { passport, config } from "./passport.js";
import { checkLoggedIn } from "./middleware.js";
import {
  configureGooglePassport,
  GOOGLE_SCOPE_PROFILE_FIELDS,
} from "./google.passport.js";
import { HttpAuthFailure, HttpGetMe, HttpLogout } from "./auth.controller.js";
import {
  isLocalHostname,
  isTenantUsable,
  normalizeHostname,
  resolveTenantByHostname,
  resolveTenantForOrigin,
} from "../../services/tenant/tenant-domain.service.ts";

type GoogleAuthOptions = {
  scope?: string[];
  state?: string;
  callbackURL?: string;
  failureRedirect?: string;
};

const AuthRouter = Router();

configureGooglePassport();

// Optional: a shared login host that isn't a tenant domain
// (e.g. https://auth.yourplatform.com). Tenant API hosts come from
// TenantDomain, so they need no env entry.
const allowedApiOrigins =
  process.env.API_ORIGIN_WHITELIST?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) || [];

const isProduction = process.env.NODE_ENV === "production";

function encodeOAuthState(state: object) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeOAuthState(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function getRequestOrigin(req: Request) {
  const origin = req.get("origin");
  const referer = req.get("referer");

  if (origin) return origin;

  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

// The callback URL is built from the host the login was started on, so
// that host must be ours: a verified tenant domain, the shared login host,
// or localhost in development.
async function getApiOrigin(req: Request) {
  const protocol = req.protocol;
  const host = req.get("host");

  if (!host) {
    throw new Error("Missing request host.");
  }

  const apiOrigin = `${protocol}://${host}`;
  const hostname = normalizeHostname(host);

  const allowed =
    allowedApiOrigins.includes(apiOrigin) ||
    (!isProduction && isLocalHostname(hostname)) ||
    Boolean(await resolveTenantByHostname(hostname));

  if (!allowed) {
    throw new Error(`API origin is not allowed: ${apiOrigin}`);
  }

  return apiOrigin;
}

// The site that sent the user to log in, if it belongs to an active tenant.
async function getLoginSite(req: Request) {
  const origin = getRequestOrigin(req);
  const tenant = await resolveTenantForOrigin(origin);

  if (!origin || !tenant) return null;

  return { origin: new URL(origin).origin, tenant };
}

function getSafeRedirectPath(path: unknown) {
  if (typeof path !== "string") return "/";

  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";

  return path;
}

/**
 * The OAuth state carries where to send the user after login plus a random
 * nonce that is also saved in their session. The callback only accepts a
 * state whose nonce matches the browser's session, so an attacker can't
 * finish a login on someone else's browser (login CSRF). The tenant is kept
 * in the session for the verify callback.
 */
function buildOAuthState(
  req: Request,
  site: { origin: string; tenant: { id: string } },
) {
  const redirectPath = getSafeRedirectPath(req.query.path);
  const nonce = randomBytes(16).toString("hex");

  (req.session as any).oauthNonce = nonce;
  (req.session as any).oauthTenantId = site.tenant.id;

  return encodeOAuthState({
    redirectPath,
    clientOrigin: site.origin,
    nonce,
  });
}

function nonceMatches(expected: unknown, received: unknown) {
  if (typeof expected !== "string" || typeof received !== "string") {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(received);

  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyOAuthState(req: Request, res: Response, next: NextFunction) {
  const state = decodeOAuthState(req.query.state) as { nonce?: string } | null;
  const expected = (req.session as any)?.oauthNonce;

  // One use only.
  if (req.session) delete (req.session as any).oauthNonce;

  if (!nonceMatches(expected, state?.nonce)) {
    return res.redirect("/auth/failure");
  }

  next();
}

async function handleOAuthRedirect(req: Request, res: Response) {
  const state = decodeOAuthState(req.query.state) as {
    redirectPath?: string;
    clientOrigin?: string;
  } | null;

  // Only send users back to a site of the tenant they just signed in to.
  const tenant = await resolveTenantForOrigin(state?.clientOrigin).catch(
    () => null,
  );
  const clientOrigin =
    state?.clientOrigin && tenant && tenant.id === req.user?.tenantId
      ? state.clientOrigin
      : config.DEFAULT_CLIENT_URL;

  const redirectPath = getSafeRedirectPath(state?.redirectPath);
  const redirectUrl = new URL(redirectPath, clientOrigin).toString();

  res.redirect(redirectUrl);
}

/**
 * Starts a Google login for the tenant whose site sent the user here.
 * Unknown sites and inactive tenants are refused before going to Google.
 */
function startGoogleLogin(
  strategy: string,
  callbackPath: string,
  { allowInactiveTenant = false }: { allowInactiveTenant?: boolean } = {},
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site = await getLoginSite(req);

      // Customers can't log in to an inactive tenant. Admin login continues:
      // the verify step only lets super admins into an inactive tenant.
      if (
        !site ||
        (!allowInactiveTenant && !isTenantUsable(site.tenant.status))
      ) {
        return res.redirect("/auth/failure");
      }

      const options: GoogleAuthOptions = {
        scope: GOOGLE_SCOPE_PROFILE_FIELDS,
        state: buildOAuthState(req, site),
        callbackURL: `${await getApiOrigin(req)}${callbackPath}`,
      };

      passport.authenticate(strategy, options)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function finishGoogleLogin(strategy: string, callbackPath: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options: GoogleAuthOptions = {
        failureRedirect: "/auth/failure",
        callbackURL: `${await getApiOrigin(req)}${callbackPath}`,
      };

      passport.authenticate(strategy, options)(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

// ---------- ADMIN GOOGLE LOGIN ----------

AuthRouter.get(
  "/admin/google",
  startGoogleLogin("google-admin", "/auth/admin/google/callback", {
    allowInactiveTenant: true,
  }),
);

AuthRouter.get(
  "/admin/google/callback",
  verifyOAuthState,
  finishGoogleLogin("google-admin", "/auth/admin/google/callback"),
  handleOAuthRedirect,
);

// ---------- CLIENT GOOGLE LOGIN ----------

AuthRouter.get(
  "/client/google",
  startGoogleLogin("google-client", "/auth/client/google/callback"),
);

AuthRouter.get(
  "/client/google/callback",
  verifyOAuthState,
  finishGoogleLogin("google-client", "/auth/client/google/callback"),
  handleOAuthRedirect,
);

// ---------- ME ----------

AuthRouter.get("/me", checkLoggedIn, HttpGetMe);

// ---------- FAILURE ----------

AuthRouter.get("/failure", HttpAuthFailure);

// ---------- LOGOUT ----------

AuthRouter.get("/logout", HttpLogout);

export default AuthRouter;
