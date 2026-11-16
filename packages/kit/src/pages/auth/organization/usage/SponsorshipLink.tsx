import { useQuery } from "convex/react";
import { BadgeCheck } from "lucide-react";

import { api } from "@/convex";
import type { Id } from "@/convex";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/**
 * The organization's GitHub sponsorship of OpenIAP, once the maintainer has
 * linked it. Organizations without a link see nothing.
 */
export function SponsorshipLink({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const link = useQuery(api.sponsorship.query.getSponsorshipLink, {
    organizationId,
  });
  if (!link) return null;

  return (
    <section
      className="bg-card border border-border rounded-md p-6"
      aria-labelledby="sponsorship-title"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-full bg-secondary p-3">
          <BadgeCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="sponsorship-title"
            className="text-lg font-semibold text-foreground"
          >
            {"Sponsoring OpenIAP"}
          </h2>
          <div className="mt-2 space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground">
              <a
                href={`https://github.com/${link.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 break-all"
              >
                {`@${link.login}`}
              </a>
              {` · ${usd.format(link.monthlyUsd)}${link.isOneTime ? " one-time" : " a month"}`}
            </p>
            <p>
              {
                "Thank you for supporting OpenIAP. IAPKit sends this organization no sponsorship requests while the sponsorship continues."
              }
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
