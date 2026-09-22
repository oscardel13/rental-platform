// src/utils/date.utils.ts

export function parseDateOnly(value: unknown) {
  if (!value) return null;

  const rawValue = String(value).trim();

  if (!rawValue) return null;

  const match = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const [, year, month, day] = match;

  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
}

export function requireDateOnly(value: unknown, fieldName: string) {
  const date = parseDateOnly(value);

  if (!date) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date.`);
  }

  return date;
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12),
  );
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getRentalDays(deliveryDate: Date, pickupDate: Date | null) {
  if (!pickupDate) return 14;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = pickupDate.getTime() - deliveryDate.getTime();

  return Math.max(1, Math.round(diff / msPerDay));
}
