import { useEffect, useMemo, useRef, useState } from "react";
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

type Layout = "Single" | "Compare" | "Carousel";

const DEFAULT_THEME = {
  primary: "#a47465",
  accent: "#dc6843",
  background: "#18181b",
};

export default function ProjectPaywalls() {
  const { project } = useOutletContext<ProjectContext>();
  const paywalls = useQuery(api.paywalls.query.listPaywalls, {
    apiKey: project.apiKey,
  });
  const products = useQuery(api.products.query.listProducts, {
    apiKey: project.apiKey,
  });
  const upsert = useMutation(api.paywalls.mutation.upsertPaywall);
  const remove = useMutation(api.paywalls.mutation.deletePaywall);
  const [draft, setDraft] = useState<{
    slug: string;
    title: string;
    layout: Layout;
    productIds: string[];
    headline: string;
    subheadline: string;
    cta: string;
    legalCopy: string;
    features: string;
    logoUrl: string;
    backgroundImageUrl: string;
    productImages: { [productId: string]: string };
    customCss: string;
    customHtml: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
  }>({
    slug: "",
    title: "",
    layout: "Single",
    productIds: [],
    headline: "",
    subheadline: "",
    cta: "Continue",
    legalCopy: "",
    features: "",
    logoUrl: "",
    backgroundImageUrl: "",
    productImages: {},
    customCss: "",
    customHtml: "",
    primaryColor: DEFAULT_THEME.primary,
    accentColor: DEFAULT_THEME.accent,
    backgroundColor: DEFAULT_THEME.background,
  });

  const productOptions = useMemo(() => {
    if (!products) return [];
    const seen = new Set<string>();
    return products
      .filter((p) => {
        if (seen.has(p.productId)) return false;
        seen.add(p.productId);
        return true;
      })
      .map((p) => ({ id: p.productId, title: p.title, type: p.type }));
  }, [products]);

  // Build the request body that drives the live preview iframe AND
  // the eventual save. Keeping one shape avoids drift between what
  // the operator sees and what gets persisted.
  const previewPayload = useMemo(() => {
    const features = draft.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const productImages = draft.productIds
      .map((id) => ({ productId: id, imageUrl: draft.productImages[id] ?? "" }))
      .filter((p) => p.imageUrl.trim().length > 0);
    return {
      title: draft.title || "Paywall preview",
      layout: draft.layout,
      productIds: draft.productIds,
      headline: draft.headline || "Unlock the full experience",
      subheadline: draft.subheadline.trim() || undefined,
      cta: draft.cta || "Continue",
      legalCopy: draft.legalCopy.trim() || undefined,
      features: features.length ? features : undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      backgroundImageUrl: draft.backgroundImageUrl.trim() || undefined,
      productImages: productImages.length ? productImages : undefined,
      customCss: draft.customCss.trim() || undefined,
      customHtml: draft.customHtml.trim() || undefined,
      theme: {
        primaryColor: draft.primaryColor || undefined,
        accentColor: draft.accentColor || undefined,
        backgroundColor: draft.backgroundColor || undefined,
      },
    };
  }, [draft]);

  // Live preview HTML — refetched (debounced) whenever the form
  // changes. We hold raw HTML in state and feed it to an iframe via
  // `srcDoc` so the preview is fully sandboxed and doesn't share
  // styles / globals with the dashboard shell.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      void fetch(`/v1/paywalls/preview/${encodeURIComponent(project.apiKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(previewPayload),
        signal: controller.signal,
      })
        .then((r) =>
          r.ok ? r.text() : Promise.reject(new Error(String(r.status))),
        )
        .then(setPreviewHtml)
        .catch(() => {
          /* ignore — preview is best-effort, last good HTML stays */
        });
      return () => controller.abort();
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [previewPayload, project.apiKey]);

  if (paywalls === undefined || products === undefined) {
    return <PageLoading />;
  }

  const baseUrl = window.location.origin;

  const onSubmit = async () => {
    if (
      !draft.slug ||
      !draft.title ||
      !draft.headline ||
      draft.productIds.length === 0
    ) {
      return;
    }
    const features = draft.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const productImages = draft.productIds
      .map((id) => ({ productId: id, imageUrl: draft.productImages[id] ?? "" }))
      .filter((p) => p.imageUrl.trim().length > 0);
    await upsert({
      apiKey: project.apiKey,
      slug: draft.slug,
      title: draft.title,
      layout: draft.layout,
      productIds: draft.productIds,
      headline: draft.headline,
      subheadline: draft.subheadline.trim() || undefined,
      cta: draft.cta,
      legalCopy: draft.legalCopy.trim() || undefined,
      features: features.length ? features : undefined,
      logoUrl: draft.logoUrl.trim() || undefined,
      backgroundImageUrl: draft.backgroundImageUrl.trim() || undefined,
      productImages: productImages.length ? productImages : undefined,
      customCss: draft.customCss.trim() || undefined,
      customHtml: draft.customHtml.trim() || undefined,
      theme: {
        primaryColor: draft.primaryColor || undefined,
        accentColor: draft.accentColor || undefined,
        backgroundColor: draft.backgroundColor || undefined,
      },
    });
    setDraft({
      ...draft,
      slug: "",
      title: "",
      productIds: [],
      headline: "",
      subheadline: "",
      legalCopy: "",
      features: "",
      logoUrl: "",
      backgroundImageUrl: "",
      productImages: {},
      customCss: "",
      customHtml: "",
    });
  };

  const onLayoutChange = (next: Layout) => {
    setDraft((prev) => ({
      ...prev,
      layout: next,
      productIds:
        next === "Single" ? prev.productIds.slice(0, 1) : prev.productIds,
    }));
  };

  const toggleProduct = (id: string) => {
    setDraft((prev) => {
      if (prev.layout === "Single") {
        return { ...prev, productIds: prev.productIds[0] === id ? [] : [id] };
      }
      return prev.productIds.includes(id)
        ? { ...prev, productIds: prev.productIds.filter((x) => x !== id) }
        : { ...prev, productIds: [...prev.productIds, id] };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Paywalls
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Hosted at{" "}
          <Code>
            /v1/paywalls/{`{apiKey}`}/{`{slug}`}
          </Code>{" "}
          — open the URL in any of the 5 SDK WebViews. The HTML emits a{" "}
          <Code>{`{ openiap: 'purchase', productId }`}</Code> message via the
          host's WebView bridge so the SDK can dispatch the actual{" "}
          <Code>requestPurchase</Code>.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        <div className="border border-border rounded-lg bg-card p-4 space-y-5">
          <Section title="Identity">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Slug">
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="intro-2026"
                  className={inputClass}
                />
              </Field>
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="Premium intro"
                  className={inputClass}
                />
              </Field>
              <Field label="Layout">
                <div className="relative">
                  <select
                    value={draft.layout}
                    onChange={(e) => onLayoutChange(e.target.value as Layout)}
                    className={`${inputClass} appearance-none pr-8`}
                  >
                    <option value="Single">Single (one product)</option>
                    <option value="Compare">Compare (side by side)</option>
                    <option value="Carousel">Carousel (scrollable)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </Field>
            </div>
          </Section>

          <Section
            title="Products"
            hint={
              draft.layout === "Single"
                ? "Pick one"
                : draft.layout === "Compare"
                  ? "Pick 2-3 to show side by side"
                  : "Pick any to show in a carousel"
            }
          >
            {productOptions.length === 0 ? (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded px-3 py-4 text-center">
                No products yet — add some in the Products tab first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {productOptions.map((opt) => {
                  const checked = draft.productIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleProduct(opt.id)}
                      className={`text-left border rounded px-2.5 py-2 text-xs transition-colors ${
                        checked
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-border/80 bg-background"
                      }`}
                    >
                      <div className="font-medium truncate">{opt.title}</div>
                      <div className="text-muted-foreground truncate font-mono text-[10px]">
                        {opt.id}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {opt.type}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {draft.productIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60 space-y-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Per-product card image (optional, 16:9 recommended)
                </div>
                {draft.productIds.map((id) => (
                  <div key={id} className="space-y-1">
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {id}
                    </div>
                    <input
                      value={draft.productImages[id] ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          productImages: {
                            ...draft.productImages,
                            [id]: e.target.value,
                          },
                        })
                      }
                      placeholder="https://cdn.example.com/plan.jpg"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Copy">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Field label="Headline">
                  <input
                    value={draft.headline}
                    onChange={(e) =>
                      setDraft({ ...draft, headline: e.target.value })
                    }
                    placeholder="Unlock the full experience"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="CTA label">
                <input
                  value={draft.cta}
                  onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
                  placeholder="Continue"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Subheadline (optional)">
              <input
                value={draft.subheadline}
                onChange={(e) =>
                  setDraft({ ...draft, subheadline: e.target.value })
                }
                placeholder="Cancel anytime · 7-day free trial"
                className={inputClass}
              />
            </Field>
            <Field label="Features (one per line, optional)">
              <textarea
                value={draft.features}
                onChange={(e) =>
                  setDraft({ ...draft, features: e.target.value })
                }
                rows={4}
                placeholder={`Unlimited generations\nPriority support\nAd-free experience`}
                className={`${inputClass} font-sans resize-y`}
              />
            </Field>
            <Field label="Legal copy (optional)">
              <input
                value={draft.legalCopy}
                onChange={(e) =>
                  setDraft({ ...draft, legalCopy: e.target.value })
                }
                placeholder="Auto-renews until canceled. Manage in Settings."
                className={inputClass}
              />
            </Field>
          </Section>

          <Section title="Brand & visuals">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Logo URL (optional)">
                <input
                  value={draft.logoUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, logoUrl: e.target.value })
                  }
                  placeholder="https://cdn.example.com/logo.png"
                  className={inputClass}
                />
              </Field>
              <Field label="Background image URL (optional)">
                <input
                  value={draft.backgroundImageUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      backgroundImageUrl: e.target.value,
                    })
                  }
                  placeholder="https://cdn.example.com/hero.jpg"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Theme colors">
              <div className="grid grid-cols-3 gap-3">
                <ColorInput
                  label="Primary"
                  value={draft.primaryColor}
                  onChange={(v) => setDraft({ ...draft, primaryColor: v })}
                />
                <ColorInput
                  label="Accent"
                  value={draft.accentColor}
                  onChange={(v) => setDraft({ ...draft, accentColor: v })}
                />
                <ColorInput
                  label="Background"
                  value={draft.backgroundColor}
                  onChange={(v) => setDraft({ ...draft, backgroundColor: v })}
                />
              </div>
            </Field>
          </Section>

          <Section
            title="Advanced"
            hint={
              draft.customHtml.trim()
                ? "Custom HTML active — default layout bypassed"
                : "CSS overrides, or full HTML page"
            }
          >
            <Field label="Custom CSS (optional)">
              <textarea
                value={draft.customCss}
                onChange={(e) =>
                  setDraft({ ...draft, customCss: e.target.value })
                }
                rows={5}
                spellCheck={false}
                placeholder={
                  ".product { border-radius: 24px; }\n" +
                  "h1 { font-family: 'SF Pro Display', sans-serif; letter-spacing: -0.03em; }"
                }
                className={`${inputClass} font-mono text-[12px] leading-relaxed resize-y`}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Appended after the default stylesheet, so your rules win.{" "}
                <code className="font-mono">{`<style>`}</code> /{" "}
                <code className="font-mono">{`<script>`}</code> tags are
                stripped.
              </p>
            </Field>

            <Field label="Custom HTML (optional, replaces the entire page)">
              <textarea
                value={draft.customHtml}
                onChange={(e) =>
                  setDraft({ ...draft, customHtml: e.target.value })
                }
                rows={12}
                spellCheck={false}
                placeholder={`<main style="padding:40px;color:#fff;">
  <h1>${`{{openiap.paywall.headline}}`}</h1>
  <button onclick="openiap.purchase(openiap.products[0].productId)">
    ${`{{openiap.paywall.cta}}`}
  </button>
</main>

<!-- Or pull in any framework via UMD: -->
<!-- <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script> -->`}
                className={`${inputClass} font-mono text-[12px] leading-relaxed resize-y`}
              />
              <div className="mt-1 text-[10px] text-muted-foreground space-y-0.5">
                <p>
                  When set, the kit's default layout is replaced entirely with
                  your HTML. You own the page; kit only injects{" "}
                  <code className="font-mono">window.openiap</code>:
                </p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li>
                    <code className="font-mono">openiap.purchase(id)</code> →
                    fires the SDK bridge
                  </li>
                  <li>
                    <code className="font-mono">openiap.products</code> → array
                    of{" "}
                    {`{productId, title, priceAmountMicros, currency, offers}`}
                  </li>
                  <li>
                    <code className="font-mono">openiap.paywall</code> →{" "}
                    {`{title, headline, cta, theme}`}
                  </li>
                </ul>
                <p>
                  Pull in React / Vue / any framework via UMD{" "}
                  <code className="font-mono">{`<script>`}</code> tags. They
                  pass through unchanged.
                </p>
              </div>
            </Field>
          </Section>

          <div className="pt-2 border-t border-border">
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

        <div className="hidden lg:block">
          <div className="sticky top-4 space-y-2">
            <div className="text-xs text-muted-foreground flex items-center justify-between px-1">
              <span>Live preview</span>
              <span className="text-[10px]">updates as you type</span>
            </div>
            <div
              className="border border-border rounded-lg overflow-hidden bg-black"
              style={{
                aspectRatio: "9 / 16",
                maxHeight: "calc(100vh - 120px)",
              }}
            >
              {previewHtml ? (
                <iframe
                  title="Paywall preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  Loading preview…
                </div>
              )}
            </div>
          </div>
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
                  slug: <Code>{paywall.slug}</Code> · products:{" "}
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

const inputClass =
  "w-full px-2 py-1.5 rounded border border-border bg-background";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between border-b border-border pb-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-muted text-[11px] font-mono text-foreground/90 border border-border/50">
      {children}
    </code>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-[10px] text-muted-foreground mb-1">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded border border-border bg-background cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>
    </div>
  );
}
