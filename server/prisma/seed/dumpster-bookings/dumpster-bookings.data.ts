import {
  BookingStatus,
  ClientType,
  PaymentStatus,
  ServiceType,
} from "../../../src/generated/prisma/client.js";

export type DumpsterBookingSeedData = {
  bookingNumber: string;

  inventoryItemId: string;

  serviceType: ServiceType;
  projectType?: string | null;
  material: string;

  customerName: string;
  customerPhone: string;
  customerEmail: string;

  clientType?: ClientType;
  businessName?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;

  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  zip: string;

  latitude?: number | null;
  longitude?: number | null;
  distanceFromWarehouse?: number | null;

  placement: string;
  instructions: string;
  customerNotes: string;

  locationVerified: boolean;
  locationVerificationNote?: string | null;

  deliveryOffsetDays: number;
  rentalDays: number;
  rentalDaysIncluded?: number;

  pickupDateUnknown?: boolean;

  priorityDelivery?: boolean;
  priorityDeliveryNote?: string | null;

  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;

  deliveryFee?: number;
  mileageFee?: number;
  overageFee?: number;
  extraDaysFee?: number;

  addonCodes?: string[];

  stripePaymentIntentId?: string | null;
  stripePaymentStatus?: string | null;
};

export const dumpsterBookingsData: DumpsterBookingSeedData[] = [
  {
    bookingNumber: "DB-DEMO-001",
    inventoryItemId: "dumpster-17-1",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Residential Cleanout",
    material: "Household Junk",

    customerName: "Michael Torres",
    customerPhone: "(303) 555-0147",
    customerEmail: "michael.torres@example.com",

    clientType: ClientType.INDIVIDUAL,

    address1: "1842 W Cedar Ave",
    city: "Denver",
    state: "CO",
    zip: "80223",

    placement: "Driveway",
    instructions: "Place dumpster on the left side of the driveway.",
    customerNotes: "Garage cleanout and old furniture.",

    locationVerified: true,

    deliveryOffsetDays: -12,
    rentalDays: 7,

    bookingStatus: BookingStatus.COMPLETED,
    paymentStatus: PaymentStatus.PAID,

    addonCodes: ["drivewayProtection"],
  },

  {
    bookingNumber: "DB-DEMO-002",
    inventoryItemId: "dumpster-22-1",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Construction Debris",
    material: "Construction Debris",

    customerName: "Sarah Mitchell",
    customerPhone: "(720) 555-0188",
    customerEmail: "sarah.mitchell@example.com",

    clientType: ClientType.INDIVIDUAL,

    address1: "7214 E Maplewood Dr",
    city: "Aurora",
    state: "CO",
    zip: "80013",

    placement: "Driveway",
    instructions: "Keep the garage door clear.",
    customerNotes: "Kitchen remodel debris.",

    locationVerified: true,

    deliveryOffsetDays: -3,
    rentalDays: 7,

    bookingStatus: BookingStatus.ACTIVE,
    paymentStatus: PaymentStatus.PAID,

    addonCodes: [],
    priorityDelivery: true,
    priorityDeliveryNote: "Customer requested morning delivery.",
  },

  {
    bookingNumber: "DB-DEMO-003",
    inventoryItemId: "dumpster-17-2",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Concrete Removal",
    material: "Concrete",

    customerName: "Carlos Hernandez",
    customerPhone: "(303) 555-0193",
    customerEmail: "carlos.hernandez@example.com",

    clientType: ClientType.INDIVIDUAL,

    address1: "11680 York St",
    city: "Thornton",
    state: "CO",
    zip: "80233",

    placement: "Driveway",
    instructions: "Place on reinforced section near the curb.",
    customerNotes: "Patio demolition and concrete removal.",

    locationVerified: true,

    deliveryOffsetDays: 2,
    rentalDays: 8,

    bookingStatus: BookingStatus.SCHEDULED,
    paymentStatus: PaymentStatus.PAID,

    addonCodes: ["concreteSurcharge", "drivewayProtection"],
  },

  {
    bookingNumber: "DB-DEMO-004",
    inventoryItemId: "dumpster-22-2",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Remodel",
    material: "Remodeling Debris",

    customerName: "Jessica Parker",
    customerPhone: "(720) 555-0175",
    customerEmail: "jessica.parker@example.com",

    clientType: ClientType.INDIVIDUAL,

    address1: "6028 W 96th Ave",
    city: "Westminster",
    state: "CO",
    zip: "80031",

    placement: "Driveway",
    instructions: "Place on the right side of the driveway.",
    customerNotes: "Bathroom and flooring renovation.",

    locationVerified: true,

    deliveryOffsetDays: 5,
    rentalDays: 7,

    bookingStatus: BookingStatus.SCHEDULED,
    paymentStatus: PaymentStatus.PENDING,

    addonCodes: [],
  },

  {
    bookingNumber: "DB-DEMO-005",
    inventoryItemId: "dumpster-17-3",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Roofing",
    material: "Roofing",

    customerName: "Daniel Ramirez",
    customerPhone: "(303) 555-0162",
    customerEmail: "daniel.ramirez@example.com",

    clientType: ClientType.INDIVIDUAL,

    address1: "9335 W 63rd Pl",
    city: "Arvada",
    state: "CO",
    zip: "80004",

    placement: "Driveway",
    instructions: "Place near the side gate without blocking sidewalk access.",
    customerNotes: "Residential roof replacement.",

    locationVerified: true,

    deliveryOffsetDays: 9,
    rentalDays: 7,

    bookingStatus: BookingStatus.SCHEDULED,
    paymentStatus: PaymentStatus.UNPAID,

    addonCodes: ["drivewayProtection"],
  },

  {
    bookingNumber: "DB-DEMO-006",
    inventoryItemId: "dumpster-22-1",

    serviceType: ServiceType.DUMPSTER_RENTAL,
    projectType: "Commercial Renovation",
    material: "Construction Debris",

    customerName: "Robert Wilson",
    customerPhone: "(303) 555-0118",
    customerEmail: "robert.wilson@example.com",

    clientType: ClientType.BUSINESS,
    businessName: "Wilson Property Group",
    businessPhone: "(303) 555-0118",
    businessEmail: "office@wilsonproperty.example.com",

    address1: "3125 S Kipling Pkwy",
    city: "Lakewood",
    state: "CO",
    zip: "80227",

    placement: "Parking lot",
    instructions: "Leave room for contractor vehicles near the garage.",
    customerNotes: "Interior renovation debris.",

    locationVerified: true,

    deliveryOffsetDays: 13,
    rentalDays: 10,

    bookingStatus: BookingStatus.SCHEDULED,
    paymentStatus: PaymentStatus.PAID,

    addonCodes: [],
    priorityDelivery: true,
    priorityDeliveryNote: "Contractor crew starts early.",
  },
];
