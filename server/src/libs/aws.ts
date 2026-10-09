import { Route53Client } from "@aws-sdk/client-route-53";
import { SESv2Client } from "@aws-sdk/client-sesv2";

// Credentials come from the default AWS provider chain: the EC2 instance role
// in production (no keys in .env), or AWS_PROFILE / AWS_ACCESS_KEY_ID locally.

export const SES_REGION =
  process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";

let sesClient: SESv2Client | null = null;
let route53Client: Route53Client | null = null;

export function getSesClient() {
  sesClient ??= new SESv2Client({ region: SES_REGION });
  return sesClient;
}

export function getRoute53Client() {
  // Route 53 is a global service; its API lives in us-east-1.
  route53Client ??= new Route53Client({ region: "us-east-1" });
  return route53Client;
}
