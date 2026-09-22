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

// import { configureFacebookPassport } from "./facebook.passport.js";
// import { configureXPassport } from "./x.passport.js";

const allowedClientOrigins = process.env.ORIGIN_WHITELIST?.split(",") || [];

const AuthRouter = Router();

configureGooglePassport();
// configureFacebookPassport();
// configureXPassport();

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

function getSafeClientOrigin(req: Request) {
  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && allowedClientOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return config.CLIENT_URL;
}

function getSafeRedirectPath(path: unknown) {
  if (typeof path !== "string") return "/";

  // Prevent open redirects
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

function handleOAuthRedirect(req: Request, res: Response) {
  const state = decodeOAuthState(req.query.state) as {
    redirectPath?: string;
    clientOrigin?: string;
  } | null;

  const clientOrigin =
    state?.clientOrigin && allowedClientOrigins.includes(state.clientOrigin)
      ? state.clientOrigin
      : config.CLIENT_URL;

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
    })(req, res, next);
  },
);

AuthRouter.get(
  "/admin/google/callback",
  passport.authenticate("google-admin", {
    failureRedirect: "/auth/failure",
  }),
  handleOAuthRedirect,
);

// ---------- CLIENT GOOGLE LOGIN ----------
AuthRouter.get(
  "/client/google",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google-client", {
      scope: GOOGLE_SCOPE_PROFILE_FIELDS,
      state: buildOAuthState(req),
    })(req, res, next);
  },
);

AuthRouter.get(
  "/client/google/callback",
  passport.authenticate("google-client", {
    failureRedirect: "/auth/failure",
  }),
  handleOAuthRedirect,
);

// ---------- ME ----------
AuthRouter.get("/me", checkLoggedIn, HttpGetMe);

// ---------- FAILURE ----------
AuthRouter.get("/failure", HttpAuthFailure);

// ---------- LOGOUT ----------
AuthRouter.get("/logout", HttpLogout);

export default AuthRouter;
