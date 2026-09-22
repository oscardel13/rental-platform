import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD } = process.env;

if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASSWORD) {
  throw new Error("Missing email environment variables");
}

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT),
  secure: Number(EMAIL_PORT) === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

type SendMailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail({
  to,
  subject,
  text,
  html,
}: SendMailParams): Promise<void> {
  try {
    await transporter.sendMail({
      from: `Iron Peak Services <${EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}