/**
 * Manual SES setup for a tenant's sending domain.
 * Later this becomes the automated domain-onboarding flow.
 *
 *   npm run email:ses -- setup   <tenant-slug> [--route53]
 *   npm run email:ses -- status  <tenant-slug>
 *   npm run email:ses -- enable  <tenant-slug>
 *   npm run email:ses -- disable <tenant-slug>
 *   npm run email:ses -- test    <tenant-slug> <to-email>
 *   npm run email:ses -- account
 *
 * Needs AWS credentials with SES (and Route 53 for --route53) permissions.
 */
import "dotenv/config";

import {
  AlreadyExistsException,
  CreateConfigurationSetCommand,
  CreateEmailIdentityCommand,
  GetAccountCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityConfigurationSetAttributesCommand,
  PutEmailIdentityMailFromAttributesCommand,
} from "@aws-sdk/client-sesv2";
import {
  ChangeResourceRecordSetsCommand,
  ListHostedZonesByNameCommand,
  ListResourceRecordSetsCommand,
  type Change,
  type RRType,
} from "@aws-sdk/client-route-53";

import { prisma } from "../libs/prisma.ts";
import { SES_REGION, getRoute53Client, getSesClient } from "../libs/aws.ts";
import { resolveEmailSender, sendMail } from "../emails/send-mail.ts";

type DnsRecord = {
  name: string;
  type: RRType;
  value: string;
  // Only create if no record of this name/type exists (never overwrite).
  createOnly?: boolean;
};

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function getTenant(slug: string | undefined) {
  if (!slug) fail("Missing <tenant-slug>.");

  const tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant) fail(`Tenant "${slug}" not found.`);
  if (!tenant.domain) fail(`Tenant "${slug}" has no domain set.`);

  return tenant as typeof tenant & { domain: string };
}

function configurationSetName(slug: string) {
  return `tenant-${slug}`;
}

async function ensureConfigurationSet(name: string) {
  try {
    await getSesClient().send(
      new CreateConfigurationSetCommand({
        ConfigurationSetName: name,
        ReputationOptions: { ReputationMetricsEnabled: true },
        SendingOptions: { SendingEnabled: true },
      }),
    );
    console.log(`✔ Created configuration set ${name}`);
  } catch (error) {
    if (!(error instanceof AlreadyExistsException)) throw error;
    console.log(`• Configuration set ${name} already exists`);
  }
}

async function ensureDomainIdentity(domain: string, configSet: string) {
  try {
    await getSesClient().send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        ConfigurationSetName: configSet,
      }),
    );
    console.log(`✔ Created SES domain identity ${domain} (Easy DKIM)`);
  } catch (error) {
    if (!(error instanceof AlreadyExistsException)) throw error;

    console.log(`• SES identity ${domain} already exists`);

    await getSesClient().send(
      new PutEmailIdentityConfigurationSetAttributesCommand({
        EmailIdentity: domain,
        ConfigurationSetName: configSet,
      }),
    );
  }

  await getSesClient().send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: `mail.${domain}`,
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    }),
  );
  console.log(`✔ Custom MAIL FROM set to mail.${domain}`);

  return getSesClient().send(
    new GetEmailIdentityCommand({ EmailIdentity: domain }),
  );
}

function buildDnsRecords(
  domain: string,
  dkimTokens: string[],
  dmarcReportEmail?: string | null,
): DnsRecord[] {
  const dmarc = ["v=DMARC1", "p=none"];
  if (dmarcReportEmail) dmarc.push(`rua=mailto:${dmarcReportEmail}`);

  return [
    ...dkimTokens.map((token) => ({
      name: `${token}._domainkey.${domain}`,
      type: "CNAME" as RRType,
      value: `${token}.dkim.amazonses.com`,
    })),
    {
      name: `mail.${domain}`,
      type: "MX",
      value: `10 feedback-smtp.${SES_REGION}.amazonses.com`,
    },
    {
      name: `mail.${domain}`,
      type: "TXT",
      value: `"v=spf1 include:amazonses.com ~all"`,
    },
    {
      name: `_dmarc.${domain}`,
      type: "TXT",
      value: `"${dmarc.join("; ")}"`,
      createOnly: true,
    },
  ];
}

function printDnsRecords(records: DnsRecord[]) {
  console.log("\nDNS records to add:\n");
  for (const record of records) {
    console.log(
      `  ${record.type.padEnd(5)} ${record.name}\n        → ${record.value}${
        record.createOnly ? "   (skip if a DMARC record already exists)" : ""
      }`,
    );
  }
  console.log("");
}

async function findHostedZoneId(domain: string) {
  const result = await getRoute53Client().send(
    new ListHostedZonesByNameCommand({ DNSName: domain, MaxItems: 5 }),
  );

  const zone = result.HostedZones?.find(
    (candidate) =>
      candidate.Name === `${domain}.` && !candidate.Config?.PrivateZone,
  );

  return zone?.Id?.replace("/hostedzone/", "") ?? null;
}

async function recordExists(zoneId: string, name: string, type: RRType) {
  const result = await getRoute53Client().send(
    new ListResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      StartRecordName: name,
      StartRecordType: type,
      MaxItems: 1,
    }),
  );

  const record = result.ResourceRecordSets?.[0];
  return record?.Name === `${name}.` && record.Type === type;
}

async function writeRoute53Records(domain: string, records: DnsRecord[]) {
  const zoneId = await findHostedZoneId(domain);

  if (!zoneId) {
    console.log(
      `\n! No public Route 53 hosted zone for ${domain}. Add the records manually.`,
    );
    printDnsRecords(records);
    return;
  }

  const changes: Change[] = [];

  for (const record of records) {
    if (record.createOnly && (await recordExists(zoneId, record.name, record.type))) {
      console.log(`• ${record.type} ${record.name} already exists — left unchanged`);
      continue;
    }

    changes.push({
      Action: "UPSERT",
      ResourceRecordSet: {
        Name: record.name,
        Type: record.type,
        TTL: 1800,
        ResourceRecords: [{ Value: record.value }],
      },
    });
  }

  if (changes.length === 0) return;

  await getRoute53Client().send(
    new ChangeResourceRecordSetsCommand({
      HostedZoneId: zoneId,
      ChangeBatch: {
        Comment: `SES sending records for ${domain}`,
        Changes: changes,
      },
    }),
  );

  console.log(`✔ Wrote ${changes.length} records to Route 53 zone ${zoneId}`);
}

async function refreshStatus(slug: string | undefined) {
  const tenant = await getTenant(slug);

  const identity = await getSesClient().send(
    new GetEmailIdentityCommand({ EmailIdentity: tenant.domain }),
  );

  const dkimStatus = identity.DkimAttributes?.Status ?? "NOT_STARTED";
  const verified = Boolean(identity.VerifiedForSendingStatus);
  const mailFromStatus =
    identity.MailFromAttributes?.MailFromDomainStatus ?? "NOT_SET";

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      sesIdentityStatus: dkimStatus,
      sesVerifiedAt: verified ? (tenant.sesVerifiedAt ?? new Date()) : null,
    },
  });

  console.log(`\n${tenant.name} — ${tenant.domain} (SES ${SES_REGION})`);
  console.log(`  Verified for sending: ${verified ? "yes" : "no"}`);
  console.log(`  DKIM:                 ${dkimStatus}`);
  console.log(`  MAIL FROM (mail.):    ${mailFromStatus}`);
  console.log(`  Sending enabled:      ${updated.emailSendingEnabled ? "yes" : "no"}`);
  console.log(
    `  From address:         ${updated.emailFromLocalPart}@${tenant.domain}\n`,
  );

  return { tenant: updated, verified };
}

async function printAccount() {
  const account = await getSesClient().send(new GetAccountCommand({}));

  console.log(`\nSES account (${SES_REGION})`);
  console.log(
    `  Production access: ${account.ProductionAccessEnabled ? "yes" : "NO — sandbox: can only send to verified addresses"}`,
  );
  console.log(`  Sending enabled:   ${account.SendingEnabled ? "yes" : "no"}`);
  console.log(
    `  Quota:             ${account.SendQuota?.Max24HourSend ?? "?"} / 24h, ${account.SendQuota?.MaxSendRate ?? "?"} / sec (sent last 24h: ${account.SendQuota?.SentLast24Hours ?? 0})\n`,
  );
}

async function main() {
  const [command, slug, arg] = process.argv.slice(2);

  switch (command) {
    case "setup": {
      const tenant = await getTenant(slug);
      const configSet = configurationSetName(tenant.slug);

      await ensureConfigurationSet(configSet);
      const identity = await ensureDomainIdentity(tenant.domain, configSet);

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { sesConfigurationSet: configSet },
      });

      const records = buildDnsRecords(
        tenant.domain,
        identity.DkimAttributes?.Tokens ?? [],
        // DMARC aggregate reports go to the platform, not the tenant's inbox.
        process.env.DMARC_REPORT_EMAIL,
      );

      if (process.argv.includes("--route53")) {
        await writeRoute53Records(tenant.domain, records);
      } else {
        printDnsRecords(records);
      }

      await refreshStatus(slug);
      await printAccount();
      console.log(
        `Next: wait for DKIM = SUCCESS (\`npm run email:ses -- status ${tenant.slug}\`), then \`enable\`.`,
      );
      break;
    }

    case "status":
      await refreshStatus(slug);
      break;

    case "enable": {
      const { verified } = await refreshStatus(slug);
      if (!verified) fail("Domain is not verified in SES yet. Not enabling.");

      await prisma.tenant.update({
        where: { slug: slug! },
        data: { emailSendingEnabled: true },
      });
      console.log("✔ SES sending enabled for this tenant.");
      break;
    }

    case "disable":
      await getTenant(slug);
      await prisma.tenant.update({
        where: { slug: slug! },
        data: { emailSendingEnabled: false },
      });
      console.log("✔ SES sending disabled. Emails fall back to SMTP.");
      break;

    case "test": {
      const tenant = await getTenant(slug);
      if (!arg) fail("Usage: test <tenant-slug> <to-email>");

      const sender = await resolveEmailSender(tenant.id);
      console.log(`Sending via ${sender.provider} as ${sender.from} → ${arg}`);

      await sendMail({
        tenantId: tenant.id,
        to: arg,
        subject: `Test email from ${tenant.name}`,
        text: `This is a test email sent via ${sender.provider.toUpperCase()} for ${tenant.name}.`,
        html: `<p>This is a test email sent via <strong>${sender.provider.toUpperCase()}</strong> for ${tenant.name}.</p>`,
      });
      console.log("✔ Sent.");
      break;
    }

    case "account":
      await printAccount();
      break;

    default:
      fail(
        "Usage: npm run email:ses -- <setup|status|enable|disable|test|account> <tenant-slug> [...]",
      );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
