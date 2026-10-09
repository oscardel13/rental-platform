export const tenantsData = [
  {
    id: "tenant-iron-peak",
    name: "Iron Peak Services",
    slug: "iron-peak-services",
    status: "ACTIVE" as const,
    timezone: "America/Denver",

    phone: "(720) 825-7521",
    email: "ironpeakservices.llc@gmail.com",
    website: "iron-peak-services.com",

    address1: "11025 E 114th Ave",
    address2: null,
    city: "Commerce City",
    state: "CO",
    zip: "80640",
    country: "US",

    // Estimated from the address; mileage is measured from here.
    latitude: 39.903201,
    longitude: -104.858805,

    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeAccountId: "acct_1UNOUGPkanTk69mP",
  },
];

// Pricing and booking rules (same numbers as the prod seed).
export const tenantSettingsData = [
  {
    tenantId: "tenant-iron-peak",
    allowDelivery: true,
    allowCustomerPickup: false,
    deliveryFee: 0,
    freeDeliveryMiles: 20,
    perMileRate: 2,
    maxDeliveryMiles: 60,
    priorityDeliveryFee: 0,
    minNoticeDays: 1,
    maxRentalDays: 30,
    taxRate: 0,
  },
];

// Localhost maps to this tenant automatically (DEV_TENANT_SLUG); these are
// for staging or testing with real hostnames.
export const tenantDomainsData = [
  {
    tenantId: "tenant-iron-peak",
    hostname: "iron-peak-services.com",
    isPrimary: true,
  },
  {
    tenantId: "tenant-iron-peak",
    hostname: "www.iron-peak-services.com",
    isPrimary: false,
  },
  {
    tenantId: "tenant-iron-peak",
    hostname: "api.iron-peak-services.com",
    isPrimary: false,
  },
];
