import type { Request, Response, NextFunction } from "express";

import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import api from "./routes/api.ts";
import { tenantCorsOptions } from "./middleware/tenant.middleware.ts";

import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { passport, config } from "./routes/auth/passport.ts";
import { SESSION_COOKIE_NAME } from "./routes/auth/auth.controller.ts";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const isStaging = process.env.NODE_ENV === "staging";
const isSecureEnv = isProduction || isStaging;

// Behind the ALB: trust its X-Forwarded-* headers so req.ip is the real
// client (rate limits) and req.protocol is https (OAuth callback URLs).
// Only one hop, so clients can't spoof their IP with their own header.
if (isSecureEnv || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Don't advertise the framework.
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// Allowed browser origins come from TenantDomain (plus PLATFORM_ORIGINS),
// so adding a tenant doesn't need a restart.
app.use(cors(tenantCorsOptions));

const COOKIE_KEYS = (() => {
  const k1 = config.COOKIE_KEY_1;
  const k2 = config.COOKIE_KEY_2;
  if (!k1 || !k2) {
    throw new Error("Missing COOKIE_KEY_1 or COOKIE_KEY_2 in config");
  }
  return [k1, k2];
})();

const PgSession = connectPgSimple(session);

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: COOKIE_KEYS,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      maxAge: config.COOKIE_MAX_AGE,
      httpOnly: true,
      secure: isSecureEnv,
      sameSite: "lax",
    },
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(morgan("combined"));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  next();
  const delta = Date.now() - start;
  console.log(`${req.method} ${req.baseUrl}${req.url} ${delta}ms`);
});

// Health check for the ALB target group.
app.get("/", (req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/", api);

export default app;
