import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItemById,
  getInventoryItems,
  getInventoryItemsFilteredByDates,
  lockInventoryItem,
  unlockInventoryItem,
  updateInventoryItem,
} from "./inventory-item.service.ts";

export {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItemById,
  getInventoryItems,
  getInventoryItemsFilteredByDates,
  lockInventoryItem,
  unlockInventoryItem,
  updateInventoryItem,
};

export {
  createAddon,
  deleteAddon,
  getAddonById,
  getAddons,
  updateAddon,
} from "./inventory-addon.service.ts";

export { getPublicInventoryAvailabilitySummary } from "./inventory-availability.service.ts";

// Temporary backwards-compatible aliases.
// Remove these after all callers move from dumpster -> inventory item.
export const getDumpsters = getInventoryItems;
export const getDumpsterById = getInventoryItemById;
export const createDumpster = createInventoryItem;
export const updateDumpster = updateInventoryItem;
export const getDumpstersFilteredByDates = getInventoryItemsFilteredByDates;
export const deleteDumpster = deleteInventoryItem;
export const lockDumpster = lockInventoryItem;
export const unlockDumpster = unlockInventoryItem;
