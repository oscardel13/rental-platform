// src/utils/query.utils.ts

export function getQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  if (value === undefined || value === null) {
    return null;
  }

  const stringValue = String(value).trim();

  return stringValue || null;
}

export function getQueryNumber(value: unknown, fallback = 0) {
  const stringValue = getQueryString(value);

  if (!stringValue) return fallback;

  const numberValue = Number(stringValue);

  if (Number.isNaN(numberValue)) return fallback;

  return numberValue;
}

export function getQueryBoolean(value: unknown, fallback = false) {
  const stringValue = getQueryString(value);

  if (!stringValue) return fallback;

  return ["true", "1", "yes", "y"].includes(stringValue.toLowerCase());
}
