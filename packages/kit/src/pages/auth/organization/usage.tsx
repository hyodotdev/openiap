import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Heart } from "lucide-react";

import { api } from "@/convex";

export default function OrganizationUsagePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();

  const organization = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );

  const organizationReceiptStats = useQuery(
    api.purchases.query.getOrganizationReceiptStats,
    organization ? { organizationId: organization._id } : "skip",
  );

  if (organization === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p>{"Loading..."}</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    // `getOrganizationBySlug` returns `null` for two reasons:
    // the slug doesn't exist, or the signed-in user is not a member
    // of that org. Either way the page cannot render — showing a
    // spinner here made the UI look stuck. Use the same "not found"
    // copy OrganizationLayout already uses for the unknown-slug path.
    return (
      <div className="container max-w-3xl mx-auto py-16 text-center">
        <p className="text-muted-foreground">{"Organization not found"}</p>
      </div>
    );
  }

  const monthlyCount = organization.monthlyRequestCount ?? 0;
  const totalReceipts = organizationReceiptStats?.total ?? 0;

  return (
    <div className="container max-w-4xl mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{"Usage"}</h1>
        <p className="text-muted-foreground mt-2">
          {
            "Track validation usage and stored receipt analytics. Hosted IAPKit is free under fair-use limits on shared community infrastructure."
          }
        </p>
      </div>

      <div className="space-y-6">
        <section className="bg-card border border-border rounded-lg p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">
                {"This month's verifications"}
              </p>
              <p className="text-3xl font-semibold mt-1">
                {monthlyCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {"Total receipts stored"}
              </p>
              <p className="text-3xl font-semibold mt-1">
                {totalReceipts.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-md p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-full bg-secondary p-3">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                {"Planning significant traffic?"}
              </h2>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                {
                  "Hosted IAPKit is a shared, best-effort service rather than unlimited or SLA-backed infrastructure. If your organization expects to consume a meaningful share of capacity, contact us before launch and help fund the servers, monitoring, and security the ecosystem depends on."
                }
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {
                  "Sponsorship supports shared capacity; it does not automatically reserve dedicated resources or an SLA. Self-host the MIT-licensed server when you need predictable capacity and full operational control."
                }
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://github.com/sponsors/hyodotdev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gradient"
                >
                  {"Sponsor on GitHub"}
                </a>
                <a
                  href="https://opencollective.com/openiap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  {"OpenCollective"}
                </a>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  {"Self-host IAPKit"}
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {"Capacity planning: "}
                <a href="mailto:hyo@hyo.dev" className="link">
                  hyo@hyo.dev
                </a>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
