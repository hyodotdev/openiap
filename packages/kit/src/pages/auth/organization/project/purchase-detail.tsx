import { useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import { useQuery } from "convex/react";
import { api, Id } from "@/convex";
import { Badge } from "@/components/Badge";
import { PageLoading } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Copy,
  ClipboardCheck,
} from "lucide-react";
import { FALLBACK_VALUE, getPurchaseStateDisplay } from "./receipt-utils";

interface ProjectData {
  _id: Id<"projects">;
  organizationId: Id<"organizations">;
  name: string;
  slug: string;
  platform?: string;
}

interface OutletContext {
  project: ProjectData;
}

type DetailItem = {
  label: string;
  value: string | number | null | undefined | React.ReactNode;
  monospace?: boolean;
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function formatJson(value: unknown): string | null {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return null;
  }
}

function DetailSection({
  title,
  items,
}: {
  title?: string;
  items: DetailItem[];
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      {title && (
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      )}
      <dl className={cn("space-y-4", title && "mt-4")}>
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {item.label}
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm text-foreground break-words",
                item.monospace && "font-mono text-xs text-muted-foreground",
              )}
            >
              {item.value === undefined ||
              item.value === null ||
              item.value === ""
                ? FALLBACK_VALUE
                : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function PurchaseDetail() {
  const navigate = useNavigate();
  const {
    orgSlug = "",
    projectSlug = "",
    purchaseId,
  } = useParams<{
    orgSlug: string;
    projectSlug: string;
    purchaseId: string;
  }>();
  const { project } = useOutletContext<OutletContext>();
  const { search } = useLocation();
  const [copied, setCopied] = useState(false);

  const purchase = useQuery(
    api.purchases.query.getPurchaseById,
    purchaseId ? { purchaseId: purchaseId as Id<"purchases"> } : "skip",
  );

  const backToList = () => {
    const searchSuffix = search ? `${search}` : "";
    void navigate(
      `/${orgSlug}/project/${projectSlug}/purchases${searchSuffix}`,
    );
  };

  const getStoreLabel = (store?: string) => {
    if (store === "apple") {
      return "App Store";
    }
    if (store === "google") {
      return "Google Play";
    }
    if (store === "horizon") {
      return "Meta Horizon";
    }
    if (store === "amazon") {
      return "Amazon Appstore";
    }
    return store ?? FALLBACK_VALUE;
  };

  if (!project || purchase === undefined) {
    return <PageLoading />;
  }

  if (!purchaseId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {"Back to purchases"}
        </button>
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="font-medium">
            {"Purchase ID is missing from the URL."}
          </p>
        </div>
      </div>
    );
  }

  if (purchase === null) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {"Back to purchases"}
        </button>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold">{"Purchase not found"}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {`We couldn't find a purchase with ID "${purchaseId}".`}
          </p>
        </div>
      </div>
    );
  }

  if (purchase.projectId !== project._id) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {"Back to purchases"}
        </button>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold">
            {"Different project purchase"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {
              "This purchase belongs to another project. Go back to the purchases tab to select a purchase from this project."
            }
          </p>
        </div>
      </div>
    );
  }

  const productId =
    (purchase as { productId?: string | null }).productId ?? null;

  const remoteResponse = purchase.remoteResponse
    ? parseJson(purchase.remoteResponse)
    : undefined;

  const formattedRemoteResponse: string | null = (() => {
    if (!purchase.remoteResponse) {
      return null;
    }
    return formatJson(remoteResponse);
  })();

  const requestPayload = (() => {
    return formatJson(purchase.requestData);
  })();

  const requestItems: DetailItem[] = [
    {
      label: "Request payload",
      value: requestPayload ? (
        <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {requestPayload}
        </pre>
      ) : undefined,
      monospace: Boolean(requestPayload),
    },
  ];

  const remoteResponseItems: DetailItem[] | null = formattedRemoteResponse
    ? [
        {
          label: "Remote response",
          value: <pre>{formattedRemoteResponse}</pre>,
          monospace: true,
        },
      ]
    : null;

  const copyPurchaseId = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(purchase._id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={backToList}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back to purchases"}
      </button>

      <div>
        <h2 className="text-2xl font-bold mb-1">{"Receipt details"}</h2>
        <p className="text-muted-foreground">
          {"Inspect every data point we captured for this validated purchase."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              {"Status"}
            </p>
            <div className="mt-2">
              <Badge
                variant={purchase.isValid ? "success" : "danger"}
                size="sm"
                icon={
                  purchase.isValid ? (
                    <CheckCircle2 className="w-full h-full" />
                  ) : (
                    <XCircle className="w-full h-full" />
                  )
                }
              >
                {purchase.isValid ? "Valid" : "Invalid"}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{"State"}</p>
            <div className="mt-2">
              {(() => {
                const { label, variant } = getPurchaseStateDisplay(
                  purchase.state,
                );
                return (
                  <Badge variant={variant} size="sm">
                    {label}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">{"Store"}</p>
            <p className="text-lg font-semibold mt-2">
              {getStoreLabel(purchase.store)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              {"Purchase ID"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                {purchase._id}
              </code>
              <button
                type="button"
                onClick={() => {
                  void copyPurchaseId();
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {copied ? (
                  <>
                    <ClipboardCheck className="w-3 h-3" />
                    {"Copied"}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    {"Copy"}
                  </>
                )}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              {"Request IP"}
            </p>
            <p className="text-lg font-semibold mt-2 font-mono text-sm text-muted-foreground">
              {purchase.requestIp ?? FALLBACK_VALUE}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              {"Product ID"}
            </p>
            <p className="text-lg font-semibold mt-2 font-mono text-sm text-muted-foreground">
              {productId ?? FALLBACK_VALUE}
            </p>
          </div>
        </div>
      </div>

      {remoteResponseItems && <DetailSection items={remoteResponseItems} />}
      <DetailSection items={requestItems} />
    </div>
  );
}
