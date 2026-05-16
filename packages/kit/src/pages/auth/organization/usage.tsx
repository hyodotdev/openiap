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
          {"Track your monthly API usage. All validations are free."}
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

        <section className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 p-3">
              <Heart className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                {"Support OpenIAP"}
              </h2>
              <p className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-2 mb-4">
                {
                  "IAPKit is free for everyone. If your team or company depends on it, consider supporting the project so we can keep it running for thousands of indie developers."
                }
              </p>
              <a
                href="https://openiap.dev/sponsors"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium transition-colors"
              >
                {"Become a sponsor"}
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
