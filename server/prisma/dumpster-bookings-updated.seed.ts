// dumpster-bookings.seed.ts
//
// Demo booking data for the rest of August 2026 and September 2026.
// These are intentionally fictional customers/contact details for portfolio/demo use.
//
// IMPORTANT:
// - `dumpsterLabel` is included instead of a database `dumpsterId` so your main
//   Prisma seed can resolve each booking against the dumpsters you create.
// - Adjust BookingStatus / PaymentStatus values in your main seed if your Prisma
//   enums use different names.
// - Pricing here uses the values we discussed:
//     17Y base: $375
//     22Y base: $450
//     17Y concrete surcharge: $150
//     22Y concrete surcharge: $200
//     7 included days
//     $25 per additional day
//
// Delivery/mileage/overage/add-on fees are left at $0 so this seed does not
// invent pricing rules that may differ from your current calculator.

export type DemoDumpsterBooking = {
  bookingNumber: string;

  dumpsterLabel: string;
  dumpsterSize: number;

  material: string;
  serviceType: "DUMPSTER_RENTAL";

  customerName: string;
  customerPhone: string;
  customerEmail: string;

  address1: string;
  city: string;
  state: string;
  zip: string;

  placement: string;
  instructions?: string;
  customerNotes?: string;

  locationVerified: boolean;

  deliveryDate: Date;
  pickupDate: Date;
  pickupDateUnknown: boolean;

  rentalDaysIncluded: number;

  basePrice: number;
  concreteSurcharge: number;
  deliveryFee: number;
  mileageFee: number;
  extraDaysFee: number;
  overageFee: number;
  addonsTotal: number;
  totalPrice: number;

  // Booking status follows the current lifecycle used by the app:
  // SCHEDULED = upcoming rental, ACTIVE = dumpster currently with customer.
  bookingStatus: "SCHEDULED" | "ACTIVE";
  paymentStatus: "PAID" | "UNPAID";
};

const booking = (
  data: Omit<
    DemoDumpsterBooking,
    | "serviceType"
    | "locationVerified"
    | "pickupDateUnknown"
    | "rentalDaysIncluded"
    | "deliveryFee"
    | "mileageFee"
    | "overageFee"
    | "addonsTotal"
  >,
): DemoDumpsterBooking => ({
  ...data,
  serviceType: "DUMPSTER_RENTAL",
  locationVerified: true,
  pickupDateUnknown: false,
  rentalDaysIncluded: 7,
  deliveryFee: 0,
  mileageFee: 0,
  overageFee: 0,
  addonsTotal: 0,
});

export const august2026DumpsterBookings: DemoDumpsterBooking[] = [
  booking({
    bookingNumber: "DB-2026-0814-001",
    dumpsterLabel: "17Y #2",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Michael Torres",
    customerPhone: "(303) 555-0147",
    customerEmail: "michael.torres@example.com",
    address1: "1842 W Cedar Ave",
    city: "Denver",
    state: "CO",
    zip: "80223",
    placement: "Driveway",
    instructions: "Place dumpster on the left side of the driveway.",
    customerNotes: "Garage cleanout and old furniture.",
    deliveryDate: new Date("2026-08-14T09:00:00-06:00"),
    pickupDate: new Date("2026-08-21T09:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "ACTIVE",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0819-002",
    dumpsterLabel: "22Y #1",
    dumpsterSize: 22,
    material: "Construction Debris",
    customerName: "Sarah Mitchell",
    customerPhone: "(720) 555-0188",
    customerEmail: "sarah.mitchell@example.com",
    address1: "7214 E Maplewood Dr",
    city: "Aurora",
    state: "CO",
    zip: "80013",
    placement: "Driveway",
    instructions: "Keep the garage door clear.",
    customerNotes: "Kitchen remodel debris.",
    deliveryDate: new Date("2026-08-19T08:30:00-06:00"),
    pickupDate: new Date("2026-08-26T08:30:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 450,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0820-003",
    dumpsterLabel: "17Y #1",
    dumpsterSize: 17,
    material: "Roofing",
    customerName: "Daniel Ramirez",
    customerPhone: "(303) 555-0162",
    customerEmail: "daniel.ramirez@example.com",
    address1: "9335 W 63rd Pl",
    city: "Arvada",
    state: "CO",
    zip: "80004",
    placement: "Driveway",
    instructions: "Place near the side gate without blocking sidewalk access.",
    customerNotes: "Residential roof replacement.",
    deliveryDate: new Date("2026-08-20T10:00:00-06:00"),
    pickupDate: new Date("2026-08-27T10:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0822-004",
    dumpsterLabel: "17Y #3",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Emily Johnson",
    customerPhone: "(720) 555-0124",
    customerEmail: "emily.johnson@example.com",
    address1: "4521 S Benton St",
    city: "Denver",
    state: "CO",
    zip: "80235",
    placement: "Driveway",
    instructions: "Back into driveway and place beside the parked trailer.",
    customerNotes: "Basement and storage cleanout.",
    deliveryDate: new Date("2026-08-22T09:30:00-06:00"),
    pickupDate: new Date("2026-08-29T09:30:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0824-005",
    dumpsterLabel: "22Y #2",
    dumpsterSize: 22,
    material: "Concrete",
    customerName: "Carlos Hernandez",
    customerPhone: "(303) 555-0193",
    customerEmail: "carlos.hernandez@example.com",
    address1: "11680 York St",
    city: "Thornton",
    state: "CO",
    zip: "80233",
    placement: "Driveway",
    instructions: "Place on reinforced section near the curb.",
    customerNotes: "Patio demolition and concrete removal.",
    deliveryDate: new Date("2026-08-24T08:00:00-06:00"),
    pickupDate: new Date("2026-09-02T08:00:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 200,
    extraDaysFee: 50,
    totalPrice: 700,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0825-006",
    dumpsterLabel: "17Y #2",
    dumpsterSize: 17,
    material: "Remodeling Debris",
    customerName: "Jessica Parker",
    customerPhone: "(720) 555-0175",
    customerEmail: "jessica.parker@example.com",
    address1: "6028 W 96th Ave",
    city: "Westminster",
    state: "CO",
    zip: "80031",
    placement: "Driveway",
    instructions: "Place on the right side of the driveway.",
    customerNotes: "Bathroom and flooring renovation.",
    deliveryDate: new Date("2026-08-25T11:00:00-06:00"),
    pickupDate: new Date("2026-09-01T11:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0829-007",
    dumpsterLabel: "22Y #1",
    dumpsterSize: 22,
    material: "Construction Debris",
    customerName: "Robert Wilson",
    customerPhone: "(303) 555-0118",
    customerEmail: "robert.wilson@example.com",
    address1: "3125 S Kipling Pkwy",
    city: "Lakewood",
    state: "CO",
    zip: "80227",
    placement: "Driveway",
    instructions: "Leave room for contractor vehicles near the garage.",
    customerNotes: "Interior renovation debris.",
    deliveryDate: new Date("2026-08-29T08:30:00-06:00"),
    pickupDate: new Date("2026-09-05T08:30:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 450,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),
];

export const september2026DumpsterBookings: DemoDumpsterBooking[] = [
  booking({
    bookingNumber: "DB-2026-0902-008",
    dumpsterLabel: "17Y #1",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Amanda Lopez",
    customerPhone: "(720) 555-0131",
    customerEmail: "amanda.lopez@example.com",
    address1: "8740 W 20th Ave",
    city: "Lakewood",
    state: "CO",
    zip: "80215",
    placement: "Driveway",
    instructions: "Place near the back fence.",
    customerNotes: "Whole-house decluttering before a move.",
    deliveryDate: new Date("2026-09-02T09:00:00-06:00"),
    pickupDate: new Date("2026-09-09T09:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0904-009",
    dumpsterLabel: "17Y #3",
    dumpsterSize: 17,
    material: "Construction Debris",
    customerName: "Kevin Martinez",
    customerPhone: "(303) 555-0155",
    customerEmail: "kevin.martinez@example.com",
    address1: "4432 E 116th Ave",
    city: "Thornton",
    state: "CO",
    zip: "80233",
    placement: "Driveway",
    instructions: "Position close to side entrance.",
    customerNotes: "Small residential addition.",
    deliveryDate: new Date("2026-09-04T10:30:00-06:00"),
    pickupDate: new Date("2026-09-11T10:30:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0906-010",
    dumpsterLabel: "22Y #2",
    dumpsterSize: 22,
    material: "Roofing",
    customerName: "Brian Anderson",
    customerPhone: "(720) 555-0199",
    customerEmail: "brian.anderson@example.com",
    address1: "10320 W 80th Ave",
    city: "Arvada",
    state: "CO",
    zip: "80005",
    placement: "Driveway",
    instructions: "Place near front edge of driveway for roofing crew.",
    customerNotes: "Full residential roof tear-off.",
    deliveryDate: new Date("2026-09-06T08:00:00-06:00"),
    pickupDate: new Date("2026-09-13T08:00:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 450,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0908-011",
    dumpsterLabel: "17Y #2",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Rachel Thompson",
    customerPhone: "(303) 555-0141",
    customerEmail: "rachel.thompson@example.com",
    address1: "5128 S Quail St",
    city: "Littleton",
    state: "CO",
    zip: "80127",
    placement: "Driveway",
    instructions: "Keep access to second garage bay open.",
    customerNotes: "Estate cleanout.",
    deliveryDate: new Date("2026-09-08T09:30:00-06:00"),
    pickupDate: new Date("2026-09-15T09:30:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0910-012",
    dumpsterLabel: "22Y #1",
    dumpsterSize: 22,
    material: "Concrete",
    customerName: "Jose Garcia",
    customerPhone: "(720) 555-0168",
    customerEmail: "jose.garcia@example.com",
    address1: "2310 E 104th Ave",
    city: "Northglenn",
    state: "CO",
    zip: "80233",
    placement: "Driveway",
    instructions: "Place on flat section beside the garage.",
    customerNotes: "Driveway and walkway concrete removal.",
    deliveryDate: new Date("2026-09-10T08:30:00-06:00"),
    pickupDate: new Date("2026-09-18T08:30:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 200,
    extraDaysFee: 25,
    totalPrice: 675,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0913-013",
    dumpsterLabel: "17Y #1",
    dumpsterSize: 17,
    material: "Remodeling Debris",
    customerName: "Megan Collins",
    customerPhone: "(303) 555-0109",
    customerEmail: "megan.collins@example.com",
    address1: "7785 S Pierce Way",
    city: "Littleton",
    state: "CO",
    zip: "80128",
    placement: "Driveway",
    instructions: "Place along right edge of driveway.",
    customerNotes: "Kitchen cabinets, flooring, and drywall.",
    deliveryDate: new Date("2026-09-13T10:00:00-06:00"),
    pickupDate: new Date("2026-09-20T10:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0916-014",
    dumpsterLabel: "17Y #3",
    dumpsterSize: 17,
    material: "Roofing",
    customerName: "David Nguyen",
    customerPhone: "(720) 555-0129",
    customerEmail: "david.nguyen@example.com",
    address1: "14550 E 48th Ave",
    city: "Denver",
    state: "CO",
    zip: "80239",
    placement: "Driveway",
    instructions: "Place close to front of house for shingle disposal.",
    customerNotes: "Roof replacement project.",
    deliveryDate: new Date("2026-09-16T08:00:00-06:00"),
    pickupDate: new Date("2026-09-23T08:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0918-015",
    dumpsterLabel: "22Y #2",
    dumpsterSize: 22,
    material: "Construction Debris",
    customerName: "Anthony Rivera",
    customerPhone: "(303) 555-0184",
    customerEmail: "anthony.rivera@example.com",
    address1: "6590 W 74th Ave",
    city: "Arvada",
    state: "CO",
    zip: "80003",
    placement: "Driveway",
    instructions: "Place near side-yard gate.",
    customerNotes: "Basement finishing project.",
    deliveryDate: new Date("2026-09-18T09:00:00-06:00"),
    pickupDate: new Date("2026-09-25T09:00:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 450,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0921-016",
    dumpsterLabel: "17Y #2",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Lauren Brooks",
    customerPhone: "(720) 555-0113",
    customerEmail: "lauren.brooks@example.com",
    address1: "2840 S Holly St",
    city: "Denver",
    state: "CO",
    zip: "80222",
    placement: "Driveway",
    instructions: "Place near curb while keeping sidewalk clear.",
    customerNotes: "Moving cleanout and furniture disposal.",
    deliveryDate: new Date("2026-09-21T11:00:00-06:00"),
    pickupDate: new Date("2026-09-28T11:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0923-017",
    dumpsterLabel: "22Y #1",
    dumpsterSize: 22,
    material: "Construction Debris",
    customerName: "Christopher Lee",
    customerPhone: "(303) 555-0172",
    customerEmail: "christopher.lee@example.com",
    address1: "9180 Yates St",
    city: "Westminster",
    state: "CO",
    zip: "80031",
    placement: "Driveway",
    instructions: "Place near garage but leave pedestrian path open.",
    customerNotes: "Multi-room renovation.",
    deliveryDate: new Date("2026-09-23T08:30:00-06:00"),
    pickupDate: new Date("2026-09-30T08:30:00-06:00"),
    basePrice: 450,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 450,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),

  booking({
    bookingNumber: "DB-2026-0925-018",
    dumpsterLabel: "17Y #1",
    dumpsterSize: 17,
    material: "Remodeling Debris",
    customerName: "Samantha Reed",
    customerPhone: "(720) 555-0150",
    customerEmail: "samantha.reed@example.com",
    address1: "3387 S Independence Ct",
    city: "Lakewood",
    state: "CO",
    zip: "80227",
    placement: "Driveway",
    instructions: "Place on left side near the side entrance.",
    customerNotes: "Flooring and bathroom renovation.",
    deliveryDate: new Date("2026-09-25T10:30:00-06:00"),
    pickupDate: new Date("2026-10-02T10:30:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "PAID",
  }),

  booking({
    bookingNumber: "DB-2026-0928-019",
    dumpsterLabel: "17Y #3",
    dumpsterSize: 17,
    material: "Household Junk",
    customerName: "Marcus Hill",
    customerPhone: "(303) 555-0137",
    customerEmail: "marcus.hill@example.com",
    address1: "10745 Albion St",
    city: "Thornton",
    state: "CO",
    zip: "80233",
    placement: "Driveway",
    instructions: "Place toward street side of driveway.",
    customerNotes: "Garage and backyard cleanout.",
    deliveryDate: new Date("2026-09-28T09:00:00-06:00"),
    pickupDate: new Date("2026-10-05T09:00:00-06:00"),
    basePrice: 375,
    concreteSurcharge: 0,
    extraDaysFee: 0,
    totalPrice: 375,
    bookingStatus: "SCHEDULED",
    paymentStatus: "UNPAID",
  }),
];

export const dumpsterBookingsSeed: DemoDumpsterBooking[] = [
  ...august2026DumpsterBookings,
  ...september2026DumpsterBookings,
];

export default dumpsterBookingsSeed;
