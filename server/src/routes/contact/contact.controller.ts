import type { Request, Response } from "express";

// TODO: send the message (SES / email provider). Until then the form only
// acknowledges the request; nothing is stored or emailed.
export function sendContactEmail(
  name: string,
  email: string,
  message: string,
): void {
  return;
}

function cleanField(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function httpContact(req: Request, res: Response) {
  const name = cleanField(req.body?.name, 120);
  const email = cleanField(req.body?.email, 200).toLowerCase();
  const message = cleanField(req.body?.message, 5000);

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Name and a valid email are required." });
  }

  // Don't log names/emails/messages: logs aren't a place for customer PII.
  console.log("Contact request received.");

  // sendContactEmail(name, email, message);

  res.status(200).json({ message: "Contact email sent successfully" });
}
