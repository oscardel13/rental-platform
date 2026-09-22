// src/utils/prisma.utils.ts

import { Prisma } from "../generated/prisma/client.js";

export function toDecimal(value: unknown, fallback = 0) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return new Prisma.Decimal(fallback);
  }

  return new Prisma.Decimal(numberValue);
}

export function normalizeDecimal(value: unknown, fallback = 0) {
  if (value instanceof Prisma.Decimal) {
    return Number(value);
  }

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return numberValue;
}

export function getPrismaErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Prisma error";
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function isPrismaRecordNotFoundError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
