import { Prisma } from "../../generated/prisma/client.js";
import { sendMail } from "../send-mail.ts";

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    dumpster: true;
    addons: {
      include: {
        addon: true;
      };
    };
  };
}>;

const COMPANY = {
  name: "Iron Peak Services",
  email: "alej8521@gmail.com",
  phone: "720.825.7521",
  phoneHref: "tel:7208257521",
  slogan: "Strength You Can Stand On.",
  logoUrl: process.env.EMAIL_LOGO_URL || "",
};

function money(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "$0.00";
  }

  let amount: number;

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    amount = value.toNumber();
  } else {
    amount = Number(value);
  }

  if (Number.isNaN(amount)) {
    amount = 0;
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  const numberValue = Number(value);

  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "Not scheduled";

  let date: Date;

  if (typeof value === "string") {
    const [datePart = ""] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);

    date = new Date(Date.UTC(year || 0, (month || 1) - 1, day || 1));
  } else {
    date = value;
  }

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "";

  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function safe(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  return String(value);
}

function getDumpsterName(booking: BookingWithRelations): string {
  if (booking.dumpsterLabel) return booking.dumpsterLabel;
  if (booking.dumpster?.label) return booking.dumpster.label;
  if (booking.dumpsterSize) return `${booking.dumpsterSize} Yard Dumpster`;

  return "Dumpster Rental";
}

function getAddressHtml(booking: BookingWithRelations): string {
  return [
    booking.address1,
    booking.address2,
    `${booking.city}, ${booking.state} ${booking.zip}`,
  ]
    .filter(Boolean)
    .join("<br />");
}

function getAddressText(booking: BookingWithRelations): string {
  return [
    booking.address1,
    booking.address2,
    `${booking.city}, ${booking.state} ${booking.zip}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function getAddonName(bookingAddon: BookingWithRelations["addons"][number]) {
  return bookingAddon.addon?.name || "Add-on";
}

function getAddonTotal(bookingAddon: BookingWithRelations["addons"][number]) {
  return bookingAddon.addon?.price || 0;
}

function buildAddonRows(booking: BookingWithRelations): string {
  if (!booking.addons || booking.addons.length === 0) return "";

  return booking.addons
    .filter((bookingAddon) => toNumber(getAddonTotal(bookingAddon)) > 0)
    .map((bookingAddon) => {
      return `
        <tr>
          <td style="padding: 12px 0; color: #4b5563; border-bottom: 1px solid #e5e7eb;">
            ${getAddonName(bookingAddon)}
          </td>
          <td style="padding: 12px 0; text-align: right; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
            ${money(getAddonTotal(bookingAddon))}
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildInvoiceRows(booking: BookingWithRelations): string {
  const rows = [
    {
      label: "Base price",
      value: booking.basePrice,
    },
    {
      label: "Delivery fee",
      value: booking.deliveryFee,
    },
    {
      label: "Mileage fee",
      value: booking.mileageFee,
    },
    {
      label: "Extra days fee",
      value: booking.extraDaysFee,
    },
    {
      label: "Overage fee",
      value: booking.overageFee,
    },
  ];

  const standardRows = rows
    .filter((row) => toNumber(row.value) > 0)
    .map(
      (row) => `
        <tr>
          <td style="padding: 12px 0; color: #4b5563; border-bottom: 1px solid #e5e7eb;">
            ${row.label}
          </td>
          <td style="padding: 12px 0; text-align: right; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
            ${money(row.value)}
          </td>
        </tr>
      `
    )
    .join("");

  return standardRows + buildAddonRows(booking);
}

function buildPriorityDeliverySection(booking: BookingWithRelations): string {
  if (!booking.priorityDelivery) return "";

  return `
    <div style="background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 14px; padding: 16px; margin-bottom: 22px;">
      <div style="font-weight: 800; margin-bottom: 4px;">Priority Delivery</div>
      <div style="font-size: 14px; line-height: 1.5;">
        ${
          booking.deliveryTime
            ? `Requested delivery time: <strong>${formatTime(
                booking.deliveryTime
              )}</strong>`
            : "Customer requested priority delivery."
        }
        ${
          booking.priorityDeliveryNote
            ? `<br />${safe(booking.priorityDeliveryNote)}`
            : ""
        }
      </div>
    </div>
  `;
}

function buildJobNotesSection(booking: BookingWithRelations): string {
  if (!booking.placement && !booking.instructions && !booking.customerNotes) {
    return "";
  }

  return `
    <div style="margin-bottom: 22px;">
      <h2 style="font-size: 18px; margin: 0 0 12px;">Job Notes</h2>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        ${
          booking.placement
            ? `<div><strong>Placement:</strong> ${safe(
                booking.placement
              )}</div>`
            : ""
        }

        ${
          booking.instructions
            ? `<div><strong>Instructions:</strong> ${safe(
                booking.instructions
              )}</div>`
            : ""
        }

        ${
          booking.customerNotes
            ? `<div><strong>Customer notes:</strong> ${safe(
                booking.customerNotes
              )}</div>`
            : ""
        }
      </div>
    </div>
  `;
}

function buildBookingConfirmationHtml(booking: BookingWithRelations): string {
  const invoiceRows = buildInvoiceRows(booking);
  const dumpsterName = getDumpsterName(booking);
  const hasPickupDate = booking.pickupDate && !booking.pickupDateUnknown;

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Booking Confirmation</title>
  </head>

  <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb;">
            <tr>
              <td style="background: #111827; padding: 28px; color: #ffffff;">
                ${
                  COMPANY.logoUrl
                    ? `<img src="${COMPANY.logoUrl}" alt="${COMPANY.name}" style="max-width: 170px; margin-bottom: 18px;" />`
                    : `<div style="font-size: 22px; font-weight: 800; margin-bottom: 8px;">${COMPANY.name}</div>`
                }

                <div style="font-size: 24px; font-weight: 800; line-height: 1.3;">
                  Booking Confirmation
                </div>

                <div style="margin-top: 8px; color: #d1d5db; font-size: 14px;">
                  ${COMPANY.slogan}
                </div>

                <div style="margin-top: 16px; font-size: 13px; color: #e5e7eb;">
                  <a href="mailto:${COMPANY.email}" style="color: #ffffff; text-decoration: none;">${COMPANY.email}</a>
                  &nbsp;|&nbsp;
                  <a href="${COMPANY.phoneHref}" style="color: #ffffff; text-decoration: none;">${COMPANY.phone}</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 28px;">
                <p style="margin: 0 0 14px; font-size: 16px;">
                  Hi ${safe(booking.customerName)},
                </p>

                <p style="margin: 0 0 22px; font-size: 15px; line-height: 1.6; color: #4b5563;">
                  Thanks for booking with <strong>${COMPANY.name}</strong>. We received your booking and included your schedule and invoice summary below.
                </p>

                <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin-bottom: 22px;">
                  <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Booking Number</div>
                  <div style="font-size: 22px; font-weight: 800; color: #111827;">
                    ${safe(booking.bookingNumber)}
                  </div>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
                  <tr>
                    <td style="padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px;">
                      <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">Service</div>
                      <div style="font-size: 16px; font-weight: 700;">${safe(
                        dumpsterName
                      )}</div>
                      <div style="margin-top: 6px; color: #4b5563; font-size: 14px;">
                        Material: ${safe(booking.material)}
                      </div>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
                  <tr>
                    <td style="padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px;">
                      <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">Delivery</div>
                      <div style="font-size: 15px; font-weight: 700;">
                        ${formatDate(booking.deliveryDate)}
                      </div>
                      <div style="font-size: 14px; color: #4b5563; margin-top: 4px;">
                        ${formatTime(booking.deliveryDate)}
                      </div>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
                  <tr>
                    <td style="padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px;">
                      <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">Pickup</div>
                      <div style="font-size: 15px; font-weight: 700;">
                        ${
                          hasPickupDate
                            ? formatDate(booking.pickupDate)
                            : "Pickup date to be confirmed"
                        }
                      </div>
                      ${
                        hasPickupDate
                          ? `<div style="font-size: 14px; color: #4b5563; margin-top: 4px;">${formatTime(
                              booking.pickupDate
                            )}</div>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>

                ${buildPriorityDeliverySection(booking)}

                <div style="margin-bottom: 22px;">
                  <h2 style="font-size: 18px; margin: 0 0 12px;">Delivery Address</h2>

                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
                    ${getAddressHtml(booking)}
                  </div>
                </div>

                ${buildJobNotesSection(booking)}

                <div style="margin-bottom: 24px;">
                  <h2 style="font-size: 18px; margin: 0 0 12px;">Invoice Summary</h2>

                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                    ${
                      invoiceRows ||
                      `
                        <tr>
                          <td style="padding: 12px 0; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Base price</td>
                          <td style="padding: 12px 0; text-align: right; color: #111827; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${money(
                            booking.basePrice
                          )}</td>
                        </tr>
                      `
                    }

                    <tr>
                      <td style="padding: 16px 0 0; font-size: 18px; font-weight: 800;">
                        Total
                      </td>
                      <td style="padding: 16px 0 0; text-align: right; font-size: 22px; font-weight: 900;">
                        ${money(booking.total)}
                      </td>
                    </tr>
                  </table>
                </div>

                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
                  If anything looks incorrect, please contact us right away at
                  <a href="${COMPANY.phoneHref}" style="color: #111827; font-weight: 700;">${COMPANY.phone}</a>
                  or
                  <a href="mailto:${COMPANY.email}" style="color: #111827; font-weight: 700;">${COMPANY.email}</a>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px; text-align: center;">
                ${
                  COMPANY.logoUrl
                    ? `<img src="${COMPANY.logoUrl}" alt="${COMPANY.name}" style="max-width: 140px; margin-bottom: 12px;" />`
                    : `<div style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">${COMPANY.name}</div>`
                }

                <div style="font-size: 13px; color: #6b7280;">
                  <a href="mailto:${COMPANY.email}" style="color: #374151; text-decoration: none;">${COMPANY.email}</a>
                  &nbsp;|&nbsp;
                  <a href="${COMPANY.phoneHref}" style="color: #374151; text-decoration: none;">${COMPANY.phone}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function buildBookingConfirmationText(booking: BookingWithRelations): string {
  const addonLines =
    booking.addons && booking.addons.length > 0
      ? booking.addons
          .filter((bookingAddon) => toNumber(getAddonTotal(bookingAddon)) > 0)
          .map(
            (bookingAddon) =>
              `${getAddonName(bookingAddon)}: ${money(
                getAddonTotal(bookingAddon)
              )}`
          )
          .join("\n")
      : "Add-ons: $0.00";

  return `
Iron Peak Services Booking Confirmation

Hi ${booking.customerName},

Thanks for booking with Iron Peak Services.

Booking Number: ${booking.bookingNumber}
Service: ${getDumpsterName(booking)}
Delivery: ${formatDate(booking.deliveryDate)} ${formatTime(
    booking.deliveryDate
  )}
Pickup: ${
    booking.pickupDate && !booking.pickupDateUnknown
      ? `${formatDate(booking.pickupDate)} ${formatTime(booking.pickupDate)}`
      : "Pickup date to be confirmed"
  }

Address:
${getAddressText(booking)}

${
  booking.priorityDelivery
    ? `Priority Delivery:
${
  booking.deliveryTime
    ? `Requested delivery time: ${formatTime(booking.deliveryTime)}`
    : "Customer requested priority delivery."
}
${booking.priorityDeliveryNote ? booking.priorityDeliveryNote : ""}`
    : ""
}

Invoice Summary:
Base Price: ${money(booking.basePrice)}
Delivery Fee: ${money(booking.deliveryFee)}
Mileage Fee: ${money(booking.mileageFee)}
Extra Days Fee: ${money(booking.extraDaysFee)}
Overage Fee: ${money(booking.overageFee)}
${addonLines}
Total: ${money(booking.total)}

If anything looks incorrect, contact us at ${COMPANY.phone} or ${COMPANY.email}.
`;
}

export async function sendBookingConfirmationEmail(
  booking: BookingWithRelations
): Promise<void> {
  if (!booking.customerEmail) {
    throw new Error("Cannot send booking confirmation: customerEmail is missing");
  }

  await sendMail({
    to: booking.customerEmail,
    subject: `Booking Confirmation ${booking.bookingNumber} | Iron Peak Services`,
    text: buildBookingConfirmationText(booking),
    html: buildBookingConfirmationHtml(booking),
  });
}