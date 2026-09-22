// src/utils/money.utils.ts

export function normalizeMoney(value: unknown, fallback = 0) {
  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) {
    return fallback;
  }

  return numberValue;
}

export function toCents(value: unknown) {
  return Math.round(normalizeMoney(value) * 100);
}
