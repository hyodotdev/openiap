import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  CreditCard,
  ChevronDown,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { Badge } from "../../../../components/Badge";

type ProjectContext = { project: Doc<"projects"> };

export default function ProjectPaywalls() {
  const { project } = useOutletContext<ProjectContext>();
  const paywalls = useQuery(api.paywalls.query.listPaywalls, {
    apiKey: project.apiKey,
  });
  const upsert = useMutation(api.paywalls.mutation.upsertPaywall);
  const remove = useMutation(api.paywalls.mutation.deletePaywall);
  const [draft, setDraft] = useState({
    slug: "",
    title: "",
    layout: "Single" as "Single" | "Compare" | "Carousel",
    productIds: "",
    headline: "",
    cta: "Continue",
  });

  if (paywalls === undefined) {
    return <PageLoading />;
  }

  const baseUrl = window.location.origin;

  const onSubmit = async () => {
    const productIds = draft.productIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !draft.slug ||
      !draft.title ||
      !draft.headline ||
      productIds.length === 0
    ) {
      return;
    }
    await upsert({
      apiKey: project.apiKey,
      slug: draft.slug,
      title: draft.title,
      layout: draft.layout,
      productIds,
      headline: draft.headline,
      cta: draft.cta,
    });
    setDraft({
      ...draft,
      slug: "",
      title: "",
      productIds: "",
      headline: "",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Paywalls
        </h2>
        <p className="text-sm text-muted-foreground">
          Hosted at{" "}
          <code className="text-xs">
            /v1/paywalls/{`{apiKey}`}/{`{slug}`}
          </code>{" "}
          — open the URL in any of the 5 SDK WebViews. The HTML emits a{" "}
          <code className="text-xs">{`{ openiap: 'purchase', productId }`}</code>{" "}
          message via the host's WebView bridge so the SDK can dispatch the
          actual <code className="text-xs">requestPurchase</code>.
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card p-4 grid md:grid-cols-3 gap-3">
        <Field label="Slug">
          <input
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="intro-2026"
            className="w-full px-2 py-1.5 rounded border border-border bg-background"
          />
        </Field>
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Premium intro"
            className="w-full px-2 py-1.5 rounded border border-border bg-background"
          />
        </Field>
        <Field label="Layout">
          <div className="relative">
            <select
              value={draft.layout}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  layout: e.target.value as "Single" | "Compare" | "Carousel",
                })
              }
              className="w-full appearance-none px-2 pr-8 py-1.5 rounded border border-border bg-background"
            >
              <option value="Single">Single</option>
              <option value="Compare">Compare</option>
              <option value="Carousel">Carousel</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="Product IDs (comma-separated)">
            <input
              value={draft.productIds}
              onChange={(e) =>
                setDraft({ ...draft, productIds: e.target.value })
              }
              placeholder="com.example.premium_monthly, com.example.premium_yearly"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
        </div>
        <Field label="CTA label">
          <input
            value={draft.cta}
            onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
            placeholder="Continue"
            className="w-full px-2 py-1.5 rounded border border-border bg-background"
          />
        </Field>
        <div className="md:col-span-3">
          <Field label="Headline">
            <input
              value={draft.headline}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              placeholder="Unlock the full experience"
              className="w-full px-2 py-1.5 rounded border border-border bg-background"
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <button
            onClick={() => {
              void onSubmit();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Save paywall
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {paywalls.length === 0 && (
          <div className="border border-border rounded-lg bg-card p-8 text-center text-muted-foreground">
            No paywalls yet. Create one above to get a hosted URL.
          </div>
        )}
        {paywalls.map((paywall) => {
          const url = `${baseUrl}/v1/paywalls/${encodeURIComponent(project.apiKey)}/${encodeURIComponent(paywall.slug)}`;
          return (
            <div
              key={paywall.slug}
              className="border border-border rounded-lg bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{paywall.title}</span>
                  <Badge variant="default" size="xs">
                    {paywall.layout}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  slug: <code>{paywall.slug}</code> · products:{" "}
                  {paywall.productIds.join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
                <button
                  onClick={() => {
                    void remove({
                      apiKey: project.apiKey,
                      slug: paywall.slug,
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs">
      <span className="block text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
