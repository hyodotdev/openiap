import type { FunctionReturnType } from "convex/server";
import { v } from "convex/values";
import { Resend } from "resend";

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { sponsorshipEmail } from "./email";
import type { CurrencyAmount, SponsorshipStage } from "./logic";
import {
  collectPages,
  GRACE_PERIOD_MS,
  nextNotice,
  revenueWindowDays,
  toUsd,
} from "./logic";

// Units of each currency per US dollar. ECB reference rates first; the open
// ExchangeRate-API feed (160+ currencies) fills the currencies ECB omits.
const RATE_SOURCES = [
  "https://api.frankfurter.dev/v1/latest?base=USD",
  "https://open.er-api.com/v6/latest/USD",
];
// Replies reach the maintainer; RESEND_EMAIL_FROM may be a no-reply address.
const CONTACT_EMAIL = "hyo@hyo.dev";
const PAGE_SIZE = 10;
const CATALOG_PAGE_SIZE = 100;
const MRR_PAGE_SIZE = 100;

type Mode = "off" | "dry-run" | "send";
type Rates = Record<string, number>;

function readMode(): Mode {
  const mode = process.env.SPONSORSHIP_NOTICES_MODE;
  return mode === "dry-run" || mode === "send" ? mode : "off";
}

async function fetchUsdRates(): Promise<Rates> {
  const rates: Rates = {};
  for (const url of RATE_SOURCES) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const body = (await response.json()) as {
        rates?: Record<string, number>;
      };
      for (const [currency, rate] of Object.entries(body.rates ?? {})) {
        rates[currency] ??= rate;
      }
    } catch {
      // Try the next source.
    }
  }
  if (Object.keys(rates).length === 0) throw new Error("No FX rates");
  return rates;
}

async function sendEmail(
  to: string[],
  email: { subject: string; html: string; text: string },
  idempotencyKey: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_EMAIL_FROM;
  if (!apiKey || !from) return false;
  const replyTo = process.env.SPONSORSHIP_REPLY_TO || CONTACT_EMAIL;
  const { error } = await new Resend(apiKey).emails.send(
    {
      from: `IAPKit <${from}>`,
      to,
      replyTo,
      ...email,
    },
    { idempotencyKey },
  );
  return !error;
}

type Organization = FunctionReturnType<
  typeof internal.sponsorship.internal.listOrganizations
>["organizations"][number];

/**
 * An organization's production subscription MRR, plus charges on `days` for
 * products MRR cannot count, across all its projects.
 */
async function monthlyRevenue(
  ctx: ActionCtx,
  organization: Organization,
  now: number,
  days: string[],
): Promise<CurrencyAmount[]> {
  const amounts: CurrencyAmount[] = [];
  const projectIds = await ctx.runQuery(
    internal.sponsorship.internal.listProjectIds,
    { organizationId: organization.organizationId },
  );
  for (const projectId of projectIds) {
    const billingPeriods = await collectPages(
      (cursor, numItems) =>
        ctx.runQuery(internal.sponsorship.internal.listBillingPeriods, {
          projectId,
          paginationOpts: { numItems, cursor },
        }),
      CATALOG_PAGE_SIZE,
    );
    amounts.push(
      ...(await collectPages(
        (cursor, numItems) =>
          ctx.runQuery(internal.sponsorship.internal.sumProjectMrr, {
            projectId,
            now,
            billingPeriods,
            paginationOpts: { numItems, cursor },
          }),
        MRR_PAGE_SIZE,
      )),
    );
    for (const day of days) {
      amounts.push(
        ...(await ctx.runQuery(internal.sponsorship.internal.sumDayCharges, {
          projectId,
          day,
          billingPeriods,
        })),
      );
    }
  }
  return amounts;
}

/** Sends the notice an organization is due, if any; returns the stage counted. */
async function notify(
  ctx: ActionCtx,
  mode: Exclude<Mode, "off">,
  organization: Organization,
  usd: number,
): Promise<SponsorshipStage | null> {
  const stage = nextNotice(usd, organization.state);
  if (!stage || mode !== "send") return stage;
  const recipients = await ctx.runQuery(
    internal.sponsorship.internal.listRecipients,
    { organizationId: organization.organizationId },
  );
  const sentAt = Date.now();
  const sent =
    recipients.length > 0 &&
    (await sendEmail(
      recipients,
      sponsorshipEmail(stage, organization.name, usd, sentAt + GRACE_PERIOD_MS),
      `sponsorship-${organization.organizationId}-${stage}`,
    ));
  if (!sent) throw new Error("sponsorship email not sent");
  await ctx.runMutation(internal.sponsorship.internal.recordNotice, {
    organizationId: organization.organizationId,
    stage,
    usdMrr: Math.round(usd),
    sentAt,
  });
  return stage;
}

/**
 * Monthly: emails organizations whose production subscription revenue reached
 * a sponsorship threshold (see logic.ts and /pricing). Off unless
 * SPONSORSHIP_NOTICES_MODE is "dry-run" (counts only) or "send". Handles one
 * page of organizations per run and schedules the next, so a large run stays
 * within the action time limit. Logs aggregates, never names or addresses.
 */
export const runSponsorshipNotices = internalAction({
  args: {
    cursor: v.optional(v.string()),
    // Fixed for the whole run once the first page set them.
    rates: v.optional(v.record(v.string(), v.number())),
    days: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mode = readMode();
    if (mode === "off") return null;

    const rates: Rates = args.rates ?? (await fetchUsdRates());
    const days = args.days ?? revenueWindowDays(Date.now());
    const page: FunctionReturnType<
      typeof internal.sponsorship.internal.listOrganizations
    > = await ctx.runQuery(internal.sponsorship.internal.listOrganizations, {
      paginationOpts: { numItems: PAGE_SIZE, cursor: args.cursor ?? null },
    });
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.sponsorship.action.runSponsorshipNotices,
        { cursor: page.continueCursor, rates, days },
      );
    }

    const summary = { mode, checked: 0, advisory: 0, request: 0, failed: 0 };
    const unconverted = new Set<string>();
    for (const organization of page.organizations) {
      summary.checked += 1;
      try {
        const { usd, unconverted: missing } = toUsd(
          await monthlyRevenue(ctx, organization, Date.now(), days),
          rates,
        );
        missing.forEach((currency) => unconverted.add(currency));
        const stage = await notify(ctx, mode, organization, usd);
        if (stage) summary[stage] += 1;
      } catch (error) {
        // One organization's failure must not skip the rest; next month retries.
        summary.failed += 1;
        console.error(
          "sponsorship notice failed",
          organization.organizationId,
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }
    console.log(
      "sponsorship notices",
      JSON.stringify({ ...summary, unconverted: [...unconverted].sort() }),
    );
    return null;
  },
});
