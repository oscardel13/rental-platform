// routes/auth/google.passport.ts
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Profile, VerifyCallback } from "passport-google-oauth20";

import {
  passport,
  config,
  findOrCreateAdminFromProvider,
  findOrCreateClientFromProvider,
} from "./passport.ts";

const GOOGLE_SCOPE_PROFILE_FIELDS = ["email", "profile"];

type ValidGoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

function getGoogleProfileData(profile: Profile) {
  const json = profile._json as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  return {
    sub: json.sub,
    email: json.email,
    emailVerified: json.email_verified,
    name: json.name,
    picture: json.picture,
  };
}

function validateGoogleProfile(
  profile: Profile,
  done: VerifyCallback,
): ValidGoogleProfile | null {
  const { sub, email, emailVerified, name, picture } =
    getGoogleProfileData(profile);

  if (!sub) {
    done(null, false, {
      message: "Missing Google account id",
    });

    return null;
  }

  if (!email) {
    done(null, false, {
      message: "Missing Google email",
    });

    return null;
  }

  if (!emailVerified) {
    done(null, false, {
      message: "Email not verified",
    });

    return null;
  }

  return {
    sub,
    email,
    name: name ?? null,
    picture: picture ?? null,
  };
}

// passReqToCallback: the verify callbacks read the login tenant from the
// session.
const ADMIN_AUTH_OPTIONS = {
  clientID: config.GOOGLE_CLIENT_ID || "",
  clientSecret: config.GOOGLE_CLIENT_SECRET || "",
  passReqToCallback: true as const,
};

const CLIENT_AUTH_OPTIONS = {
  clientID: config.GOOGLE_CLIENT_ID || "",
  clientSecret: config.GOOGLE_CLIENT_SECRET || "",
  passReqToCallback: true as const,
};

// Set by the auth router when the login started, from the site's domain.
function getLoginTenantId(req: any) {
  const tenantId = req?.session?.oauthTenantId;

  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Login session expired. Please try again.");
  }

  return tenantId;
}

async function verifyGoogleAdminCallback(
  req: any,
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
) {
  try {
    const googleProfile = validateGoogleProfile(profile, done);

    if (!googleProfile) {
      return;
    }

    const user = await findOrCreateAdminFromProvider({
      tenantId: getLoginTenantId(req),
      provider: "google",
      providerId: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
    });

    return done(null, user as unknown as Express.User);
  } catch (err) {
    return done(err as Error);
  }
}

async function verifyGoogleClientCallback(
  req: any,
  _accessToken: string,
  _refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
) {
  try {
    const googleProfile = validateGoogleProfile(profile, done);

    if (!googleProfile) {
      return;
    }

    const user = await findOrCreateClientFromProvider({
      tenantId: getLoginTenantId(req),
      provider: "google",
      providerId: googleProfile.sub,
      email: googleProfile.email,
      name: googleProfile.name,
      picture: googleProfile.picture,
    });

    return done(null, user as unknown as Express.User);
  } catch (err) {
    return done(err as Error);
  }
}

export function configureGooglePassport() {
  passport.use(
    "google-admin",
    new GoogleStrategy(ADMIN_AUTH_OPTIONS, verifyGoogleAdminCallback),
  );

  passport.use(
    "google-client",
    new GoogleStrategy(CLIENT_AUTH_OPTIONS, verifyGoogleClientCallback),
  );
}

export { GOOGLE_SCOPE_PROFILE_FIELDS };
