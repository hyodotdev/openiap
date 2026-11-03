import type { SponsorshipStage } from "./logic";
import { REQUEST_USD, SUGGESTED_RATE, suggestedSponsorshipUsd } from "./logic";

const SITE = "https://kit.openiap.dev";
const SPONSOR_URL = "https://github.com/sponsors/hyodotdev";
const OPENCOLLECTIVE_URL = "https://opencollective.com/openiap";
const SELF_HOST_URL =
  "https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio";

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface SponsorshipEmail {
  subject: string;
  text: string;
  html: string;
}

/** The advisory or request email for one organization. */
export function sponsorshipEmail(
  stage: SponsorshipStage,
  organizationName: string,
  usdMrr: number,
  deadlineAt: number,
): SponsorshipEmail {
  const revenue = usdFormat.format(usdMrr);
  const suggested = usdFormat.format(suggestedSponsorshipUsd(usdMrr));
  const deadline = new Date(deadlineAt).toISOString().slice(0, 10);
  const subject =
    stage === "request"
      ? `Please sponsor IAPKit for ${organizationName}`
      : `${organizationName} has grown on IAPKit`;
  const paragraphs =
    stage === "request"
      ? [
          `The subscription revenue IAPKit tracks for ${organizationName} reached about ${revenue} a month. Congratulations on the growth.`,
          "We are sorry to ask. Sponsorship should be a choice to support open source, but IAPKit is one hosted pool that every project shares, and apps at this size use a large part of it. So we ask them to help cover its cost, and we appreciate your understanding.",
          `We suggest ${suggested} a month (${SUGGESTED_RATE * 100}% of monthly revenue) through GitHub Sponsors or OpenCollective. Please sponsor or reply by ${deadline} (UTC). If we do not hear from you by then, we may pause management features: the dashboard and analytics, product sync, MCP writes and new API keys.`,
          "Purchase verification, store notifications and webhooks never stop, so your users always get what they paid for. You can also self-host the MIT-licensed server.",
        ]
      : [
          `The subscription revenue IAPKit tracks for ${organizationName} reached about ${revenue} a month. Congratulations.`,
          `IAPKit is free and sustained by sponsors. Because every project shares one hosted pool, organizations from ${usdFormat.format(REQUEST_USD)} a month are asked, with apologies, to help cover its cost. Nothing changes for you today. If you can, please consider sponsoring now, or self-host the MIT-licensed server.`,
        ];
  const links = [
    ["Sponsor on GitHub", SPONSOR_URL],
    ["OpenCollective", OPENCOLLECTIVE_URL],
    ["How sponsorship works", `${SITE}/pricing`],
    ["Self-host IAPKit", SELF_HOST_URL],
  ] as const;

  const text = [
    ...paragraphs,
    links.map(([label, url]) => `${label}: ${url}`).join("\n"),
    "Reply to this email with any question.\nIAPKit, managed by OpenIAP",
  ].join("\n\n");

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#fefefe;font-family:Roboto,Arial,sans-serif;color:#1a1a1a;line-height:1.6">
<div style="max-width:560px;margin:0 auto">
<p style="font-size:18px;font-weight:700;margin:0 0 16px">IAPKit</p>
${paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join("\n")}
<p style="margin:20px 0">${links
    .map(
      ([label, url]) =>
        `<a href="${url}" style="color:#8a5d52;margin-right:16px">${escapeHtml(label)}</a>`,
    )
    .join("")}</p>
<p style="margin:24px 0 0;color:#6b5d54;font-size:14px">Reply to this email with any question.<br>IAPKit, managed by OpenIAP</p>
</div></body></html>`;

  return { subject, text, html };
}
