export const IRON_PEAK_TENANT_ID = "tenant-iron-peak";

export const prodTenantsData = [
  {
    id: IRON_PEAK_TENANT_ID,
    name: "Iron Peak Services",
    slug: "iron-peak-services",
    status: "ACTIVE" as const,
    timezone: "America/Denver",

    phone: "(720) 825-7521",
    email: "ironpeakservices.llc@gmail.com",
    website: "iron-peak-services.com",

    // Yard: shown to customers who pick up, and the origin for delivery
    // mileage.
    address1: "11025 E 114th Ave",
    address2: null,
    city: "Commerce City",
    state: "CO",
    zip: "80640",
    country: "US",

    // TODO(prod): confirm. Estimated from the Denver street grid; check by
    // right-clicking the yard in Google Maps (first number is latitude).
    // Mileage is measured from here, so it should be on the property.
    latitude: 39.903201 as number | null,
    longitude: -104.858805 as number | null,

    stripeCustomerId: null,
    stripeSubscriptionId: null,
    // TODO(prod): confirm this is the LIVE-mode connected account and that
    // Iron Peak has finished Stripe onboarding (charges_enabled = true).
    stripeAccountId: "acct_1UNOUGPkanTk69mP",
  },
];

// One row per tenant. These drive server-side pricing in
// booking-pricing.service.ts. All money is USD.
export const prodTenantSettingsData = [
  {
    tenantId: IRON_PEAK_TENANT_ID,

    allowDelivery: true,
    // TODO(prod): does Iron Peak let customers pick up from the yard?
    allowCustomerPickup: false,

    // TODO(prod): flat delivery fee charged on every delivery (0 if delivery
    // is baked into the item price).
    deliveryFee: 0,
    // Current site copy: first 20 miles free, $2/mile after.
    // TODO(prod): confirm 20 miles and $2/mile.
    freeDeliveryMiles: 20,
    perMileRate: 2,
    // Furthest Iron Peak delivers (straight-line miles from the yard).
    maxDeliveryMiles: 60 as number | null,
    // TODO(prod): price of the "priority delivery" option (was $49.99 as a
    // commented-out add-on).
    priorityDeliveryFee: 0,

    // TODO(prod): how many days ahead a booking must be made (1 = no
    // same-day bookings).
    minNoticeDays: 1,
    // TODO(prod): longest rental allowed in one booking.
    maxRentalDays: 30,

    // TODO(prod): sales tax as a fraction (0.0825 = 8.25%). Ask their
    // accountant whether dumpster rental is taxable where they operate;
    // 0 = no tax line.
    taxRate: 0,
  },
];

// Hostnames pointed at the ALB for this tenant. The API allows CORS and
// resolves the tenant from these, so every host the site or API is served
// from must be listed. Lowercase, no https:// or path.
export const prodTenantDomainsData = [
  // TODO(prod): confirm the live site hostnames.
  {
    tenantId: IRON_PEAK_TENANT_ID,
    hostname: "iron-peak-services.com",
    isPrimary: true,
  },
  {
    tenantId: IRON_PEAK_TENANT_ID,
    hostname: "www.iron-peak-services.com",
    isPrimary: false,
  },
  // TODO(prod): the API hostname for this tenant (e.g. api.iron-peak-services.com).
  {
    tenantId: IRON_PEAK_TENANT_ID,
    hostname: "api.iron-peak-services.com",
    isPrimary: false,
  },
];

export const TENANTS_TODOS = [
  "tenant domains: confirm site + API hostnames",
  "tenants: confirm yard latitude/longitude (estimated from the address)",
  "tenants: confirm live-mode Stripe connected account + onboarding done",
  "tenant settings: allow customer pickup?",
  "tenant settings: flat delivery fee",
  "tenant settings: confirm free radius (20 mi) and per-mile rate ($2)",
  "tenant settings: priority delivery fee",
  "tenant settings: min notice days / max rental days",
  "tenant settings: sales tax rate",
];
