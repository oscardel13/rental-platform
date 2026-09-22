import type { SelectedAddon } from "./booking-addons.service.ts";

function normalizeMoney(value: unknown) {
  return Number(value || 0);
}

export function getRentalDays(deliveryDate: Date, pickupDate: Date | null) {
  if (!pickupDate) return 14;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = pickupDate.getTime() - deliveryDate.getTime();

  return Math.max(1, Math.round(diff / msPerDay));
}

export function calculatePricing({
  inventoryItem,
  selectedAddons,
  data,
  deliveryDate,
  pickupDate,
}: {
  inventoryItem: any;
  selectedAddons: SelectedAddon[];
  data: any;
  deliveryDate: Date;
  pickupDate: Date | null;
}) {
  const rentalDaysIncluded = Number(data.rentalDaysIncluded || 14);
  const actualRentalDays = getRentalDays(deliveryDate, pickupDate);

  const basePrice = normalizeMoney(data.basePrice ?? inventoryItem.basePrice);
  const deliveryFee = normalizeMoney(data.deliveryFee);
  const mileageFee = normalizeMoney(data.mileageFee);
  const overageFee = normalizeMoney(data.overageFee);

  const extraDays = Math.max(0, actualRentalDays - rentalDaysIncluded);
  const extraDayRate = normalizeMoney(data.extraDayRate);
  const extraDaysFee = normalizeMoney(
    data.extraDaysFee ?? extraDays * extraDayRate,
  );

  const addonsTotal = selectedAddons.reduce((total, selectedAddon) => {
    return (
      total + normalizeMoney(selectedAddon.addon.price) * selectedAddon.quantity
    );
  }, 0);

  const total =
    basePrice +
    deliveryFee +
    mileageFee +
    extraDaysFee +
    overageFee +
    addonsTotal;

  return {
    rentalDaysIncluded,
    actualRentalDays,
    basePrice,
    deliveryFee,
    mileageFee,
    extraDaysFee,
    overageFee,
    addonsTotal,
    total,
  };
}
