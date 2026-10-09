// src/utils/error.utils.ts

export function createServiceError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

export function getErrorStatusCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

export function getErrorMessage(error: unknown, fallback: string) {
  // Only deliberate service errors (createServiceError, 4xx) are shown to
  // the caller; anything else (Prisma, Stripe, bugs) gets the fallback.
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode < 500
  ) {
    return error.message;
  }

  return fallback;
}
