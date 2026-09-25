import "dotenv/config";

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { passport, config } from "./passport.js";
import { checkLoggedIn } from "./middleware.js";
import {
  configureGooglePassport,
  GOOGLE_SCOPE_PROFILE_FIELDS,
} from "./google.passport.js";
import { HttpAuthFailure, HttpGetMe, HttpLogout } from "./auth.controller.js";

type GoogleAuthOptions = {
  scope?: string[];
  state?: string;
  callbackURL?: string;
  failureRedirect?: string;
};

const AuthRouter = Router();

configureGooglePassport();

const allowedClientOrigins =
  process.env.ORIGIN_WHITELIST?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) || [];

const allowedApiOrigins =
  process.env.API_ORIGIN_WHITELIST?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) || [];

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

function getApiOrigin(req: Request) {
  const protocol = req.protocol;
  const host = req.get("host");

  if (!host) {
    throw new Error("Missing request host.");
  }

  const apiOrigin = `${protocol}://${host}`;

  if (allowedApiOrigins.length && !allowedApiOrigins.includes(apiOrigin)) {
    throw new Error(`API origin is not allowed: ${apiOrigin}`);
  }

  return apiOrigin;
}

function getSafeClientOrigin(req: Request) {
  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && allowedClientOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return config.DEFAULT_CLIENT_URL;
}

function getSafeRedirectPath(path: unknown) {
  if (typeof path !== "string") return "/";

  if (!path.startsWith("/")) return "/";
  if (path.startsWith("//")) return "/";

  return path;
}

function buildOAuthState(req: Request) {
  const redirectPath = getSafeRedirectPath(req.query.path);
  const clientOrigin = getSafeClientOrigin(req);

  return encodeOAuthState({
    redirectPath,
    clientOrigin,
  });
}

function buildCallbackUrl(req: Request, callbackPath: string) {
  return `${getApiOrigin(req)}${callbackPath}`;
}

function handleOAuthRedirect(req: Request, res: Response) {
  const state = decodeOAuthState(req.query.state) as {
    redirectPath?: string;
    clientOrigin?: string;
  } | null;

  const clientOrigin =
    state?.clientOrigin && allowedClientOrigins.includes(state.clientOrigin)
      ? state.clientOrigin
      : config.DEFAULT_CLIENT_URL;

  const redirectPath = getSafeRedirectPath(state?.redirectPath);
  const redirectUrl = new URL(redirectPath, clientOrigin).toString();

  res.redirect(redirectUrl);
}

// ---------- ADMIN GOOGLE LOGIN ----------

AuthRouter.get(
  "/admin/google",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google-admin", {
      scope: GOOGLE_SCOPE_PROFILE_FIELDS,
      state: buildOAuthState(req),
      callbackURL: buildCallbackUrl(req, "/auth/admin/google/callback"),
    } as GoogleAuthOptions)(req, res, next);
  },
);

AuthRouter.get(
  "/admin/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google-admin", {
      failureRedirect: "/auth/failure",
      callbackURL: buildCallbackUrl(req, "/auth/admin/google/callback"),
    } as GoogleAuthOptions)(req, res, next);
  },
  handleOAuthRedirect,
);

// ---------- CLIENT GOOGLE LOGIN ----------

AuthRouter.get(
  "/client/google",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google-client", {
      scope: GOOGLE_SCOPE_PROFILE_FIELDS,
      state: buildOAuthState(req),
      callbackURL: buildCallbackUrl(req, "/auth/client/google/callback"),
    } as GoogleAuthOptions)(req, res, next);
  },
);

AuthRouter.get(
  "/client/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google-client", {
      failureRedirect: "/auth/failure",
      callbackURL: buildCallbackUrl(req, "/auth/client/google/callback"),
    } as GoogleAuthOptions)(req, res, next);
  },
  handleOAuthRedirect,
);

// ---------- ME ----------

AuthRouter.get("/me", checkLoggedIn, HttpGetMe);

// ---------- FAILURE ----------

AuthRouter.get("/failure", HttpAuthFailure);

// ---------- LOGOUT ----------

AuthRouter.get("/logout", HttpLogout);

export default AuthRouter;
