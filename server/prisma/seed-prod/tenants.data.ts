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

    // Yard location from Google Maps. Delivery mileage is measured from here.
    latitude: 39.903201 as number | null,
    longitude: -104.858805 as number | null,

    stripeCustomerId: null,
    stripeSubscriptionId: null,
    // Iron Peak's Stripe Connect account (booking payments go here).
    stripeAccountId: "acct_1UO4PBBofx4RYM5q",
  },
];

// One row per tenant. These drive server-side pricing in
// booking-pricing.service.ts. All money is USD.
export const prodTenantSettingsData = [
  {
    tenantId: IRON_PEAK_TENANT_ID,

    allowDelivery: true,
    // Off for liability reasons; deliveries only.
    allowCustomerPickup: false,

    // Delivery is included in the rental price; first 20 miles free, then
    // $2/mile.
    deliveryFee: 0,
    freeDeliveryMiles: 20,
    perMileRate: 2,
    // Furthest Iron Peak delivers (straight-line miles from the yard).
    maxDeliveryMiles: 60 as number | null,
    // 0 = priority delivery isn't offered (hidden on the booking form).
    priorityDeliveryFee: 0,

    // Book at least 1 day ahead (no same-day); up to 30 days per booking.
    minNoticeDays: 1,
    maxRentalDays: 30,

    // Sales tax as a fraction (0.0825 = 8.25%). 0 for now = no tax line.
    taxRate: 0,
  },
];

// Hostnames pointed at the ALB for this tenant. The API allows CORS and
// resolves the tenant from these, so every host the site or API is served
// from must be listed. Lowercase, no https:// or path.
export const prodTenantDomainsData = [
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
  // Prod API host.
  {
    tenantId: IRON_PEAK_TENANT_ID,
    hostname: "api.iron-peak-services.com",
    isPrimary: false,
  },
];

// Confirmed with Iron Peak.
export const TENANTS_TODOS: string[] = [];
