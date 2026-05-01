import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQuery, useAction } from "convex/react";
import { Layers, Plus, RefreshCw, ChevronDown } from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { Badge, PlatformBadge } from "../../../../components/Badge";

type ProjectContext = { project: Doc<"projects"> };

export default function ProjectProducts() {
  const { project } = useOutletContext<ProjectContext>();
  const products = useQuery(api.products.query.listProducts, {
    apiKey: project.apiKey,
  });
  const upsert = useMutation(api.products.mutation.upsertProduct);
  const syncApple = useAction(api.products.asc.pushSyncProductsApple);
  const syncGoogle = useAction(api.products.play.pushSyncProductsGoogle);

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    productId: "",
    platform: "IOS" as "IOS" | "Android",
    type: "Subscription" as "Subscription" | "NonConsumable" | "Consumable",
    title: "",
  });

  const grouped = useMemo(() => {
    if (!products) return { ios: [], android: [] };
    return {
      ios: products.filter((p) => p.platform === "IOS"),
      android: products.filter((p) => p.platform === "Android"),
    };
  }, [products]);

  if (products === undefined) {
    return <PageLoading />;
  }

  const onAdd = async () => {
    if (!draft.productId || !draft.title) return;
    await upsert({
      apiKey: project.apiKey,
      productId: draft.productId,
      platform: draft.platform,
      type: draft.type,
      title: draft.title,
      state: "Draft",
    });
    setDraft({ ...draft, productId: "", title: "" });
  };

  const onSync = async (platform: "IOS" | "Android") => {
    setSyncStatus(`Syncing ${platform}…`);
    try {
      const fn = platform === "IOS" ? syncApple : syncGoogle;
      const result = await fn({
        apiKey: project.apiKey,
        direction: "both",
      });
      setSyncStatus(
        `Pulled ${result.pulled}, pushed ${result.pushed}` +
          (result.failures.length
            ? `, ${result.failures.length} failure(s): ${result.failures
                .map((f) => `${f.productId} (${f.reason})`)
                .join(", ")}`
            : ""),
      );
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Products
        </h2>
        <p className="text-sm text-muted-foreground">
          kit-side catalog of every productId used by your app. Push-sync
          mirrors Draft rows to App Store Connect / Play Console using the
          credentials you uploaded; Pull-sync brings store-side changes back
          into kit.
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card p-4 grid md:grid-cols-5 gap-3 items-end">
        <Field label="Product ID">
          <input
            value={draft.productId}
            onChange={(e) => setDraft({ ...draft, productId: e.target.value })}
            placeholder="com.example.premium"
            className="w-full px-2 py-1.5 rounded border border-border bg-background"
          />
        </Field>
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Premium Monthly"
            className="w-full px-2 py-1.5 rounded border border-border bg-background"
          />
        </Field>
        <Field label="Platform">
          <SelectWithChevron
            value={draft.platform}
            onChange={(value) =>
              setDraft({
                ...draft,
                platform: value as "IOS" | "Android",
              })
            }
            options={[
              { value: "IOS", label: "iOS" },
              { value: "Android", label: "Android" },
            ]}
          />
        </Field>
        <Field label="Type">
          <SelectWithChevron
            value={draft.type}
            onChange={(value) =>
              setDraft({
                ...draft,
                type: value as "Subscription" | "NonConsumable" | "Consumable",
              })
            }
            options={[
              { value: "Subscription", label: "Subscription" },
              { value: "NonConsumable", label: "Non-consumable" },
              { value: "Consumable", label: "Consumable" },
            ]}
          />
        </Field>
        <button
          onClick={() => {
            void onAdd();
          }}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add product
        </button>
      </div>

      {syncStatus && (
        <div className="border border-border rounded-lg bg-muted/30 px-4 py-2 text-xs">
          {syncStatus}
        </div>
      )}

      <ProductGroup
        platform="IOS"
        rows={grouped.ios}
        onSync={() => {
          void onSync("IOS");
        }}
      />
      <ProductGroup
        platform="Android"
        rows={grouped.android}
        onSync={() => {
          void onSync("Android");
        }}
      />
    </div>
  );
}

function ProductGroup({
  platform,
  rows,
  onSync,
}: {
  platform: "IOS" | "Android";
  rows: Array<{
    productId: string;
    type: string;
    title: string;
    state: string;
    storeRef?: string;
    priceAmountMicros?: number;
    currency?: string;
    updatedAt: number;
  }>;
  onSync: () => void;
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={platform === "IOS" ? "ios" : "android"} />
          <span className="text-sm text-muted-foreground">
            {rows.length} product{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={onSync}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync with {platform === "IOS" ? "App Store Connect" : "Play Console"}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Product ID</th>
            <th className="px-4 py-2 text-left">Title</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-left">State</th>
            <th className="px-4 py-2 text-left">Store ref</th>
            <th className="px-4 py-2 text-left">Price</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                Nothing yet. Add a product above or hit Sync to pull an existing
                catalog.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.productId} className="border-t border-border/50">
              <td className="px-4 py-2 font-mono text-xs">{row.productId}</td>
              <td className="px-4 py-2">{row.title}</td>
              <td className="px-4 py-2">
                <Badge variant="default" size="xs">
                  {row.type}
                </Badge>
              </td>
              <td className="px-4 py-2">
                <Badge
                  variant={row.state === "Active" ? "new" : "default"}
                  size="xs"
                >
                  {row.state}
                </Badge>
              </td>
              <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                {row.storeRef ?? "—"}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {row.priceAmountMicros
                  ? `${row.currency ?? ""} ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`.trim()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

// Wrapped <select> so the chevron icon has breathing room and the
// browser's default chrome doesn't crowd the text. `appearance-none`
// hides the native arrow; we render our own ChevronDown inside the
// trailing slot of the wrapper div.
function SelectWithChevron({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-2 pr-8 py-1.5 rounded border border-border bg-background"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}
