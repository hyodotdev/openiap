import type { ReactNode } from "react";
import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePaginatedQuery, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { api, type Id } from "@/convex";
import { Badge } from "@/components/Badge";
import { LoadingSpinner, PageLoading } from "@/components/LoadingSpinner";
import { Modal } from "@/components/Modal";
import {
  isPurchaseIssueCause,
  PURCHASE_ISSUE_CAUSES,
} from "@/lib/purchaseIssues";
import { formatUtcDateTime, utcDayEnd, utcDayStart } from "@/lib/utils";
import { COMMERCE_STORES } from "../../../../../convex/commerce/contract";

type OutletContext = { project: { _id: Id<"projects"> } };

const FINGERPRINT_PREFIX = 16;
const inputClass =
  "rounded border border-border bg-background px-2 py-1 text-sm text-foreground";

export default function PurchaseIssues() {
  const { project } = useOutletContext<OutletContext>();
  const { orgSlug = "", projectSlug = "" } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const base = `/${orgSlug}/project/${projectSlug}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const causeParam = searchParams.get("cause") ?? "";
  const cause = isPurchaseIssueCause(causeParam) ? causeParam : undefined;
  const store = COMMERCE_STORES.find(
    (value) => value === searchParams.get("store"),
  );
  const productId = searchParams.get("productId")?.trim() || undefined;
  const appUserId = searchParams.get("appUserId")?.trim() || undefined;
  const fromDay = searchParams.get("from") ?? "";
  const toDay = searchParams.get("to") ?? "";
  const issueId = searchParams.get("issue");

  const issues = usePaginatedQuery(
    api.purchaseIssues.query.listPurchaseIssues,
    {
      projectId: project._id,
      cause,
      store,
      productId,
      appUserId,
      from: utcDayStart(fromDay),
      to: utcDayEnd(toDay),
    },
    { initialNumItems: 25 },
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <Link
        to={`${base}/purchases`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back to purchases"}
      </Link>
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {"Purchase issues"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {
            "Failed verifications and links from the last 30 days, most recently seen first. A repeat of the same failure adds to its count. IAPKit keeps a keyed fingerprint of the purchase evidence, never the token, JWS, or receipt."
          }
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Filter by cause"
          value={cause ?? ""}
          onChange={(event) => setParam("cause", event.target.value)}
          className={inputClass}
        >
          <option value="">{"All causes"}</option>
          {Object.entries(PURCHASE_ISSUE_CAUSES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by store"
          value={store ?? ""}
          onChange={(event) => setParam("store", event.target.value)}
          className={inputClass}
        >
          <option value="">{"All stores"}</option>
          {COMMERCE_STORES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          aria-label="Filter by product ID"
          placeholder="Product ID"
          value={searchParams.get("productId") ?? ""}
          onChange={(event) => setParam("productId", event.target.value)}
          className={`${inputClass} w-full sm:w-48`}
        />
        <input
          aria-label="Filter by app user ID"
          placeholder="App user ID"
          value={searchParams.get("appUserId") ?? ""}
          onChange={(event) => setParam("appUserId", event.target.value)}
          className={`${inputClass} w-full sm:w-48`}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {"From"}
          <input
            type="date"
            value={fromDay}
            onChange={(event) => setParam("from", event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {"To"}
          <input
            type="date"
            value={toDay}
            onChange={(event) => setParam("to", event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        {
          "Product ID matches the store-verified or the claimed product. Dates are UTC and bound when an issue was last seen."
        }
      </p>

      {issues.status === "LoadingFirstPage" ? (
        <PageLoading />
      ) : issues.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {"No purchase issues match these filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{"Cause"}</th>
                <th className="px-3 py-2 font-medium">{"Store"}</th>
                <th className="px-3 py-2 font-medium">{"Product"}</th>
                <th className="px-3 py-2 font-medium">{"Count"}</th>
                <th className="px-3 py-2 font-medium">{"First seen"}</th>
                <th className="px-3 py-2 font-medium">{"Last seen"}</th>
                <th className="px-3 py-2 font-medium">{"Environment"}</th>
                <th className="px-3 py-2 font-medium">{"Retry after"}</th>
                <th className="px-3 py-2 font-medium">{"Correlation ID"}</th>
                <th className="px-3 py-2 font-medium">{"Fingerprint"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {issues.results.map((issue) => (
                <tr key={issue._id} className="align-top">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setParam("issue", issue._id)}
                      className="text-left font-medium text-primary hover:underline"
                    >
                      {PURCHASE_ISSUE_CAUSES[issue.cause].label}
                    </button>
                    <div className="font-mono text-xs text-muted-foreground">
                      {issue.cause}
                    </div>
                  </td>
                  <td className="px-3 py-2">{issue.store}</td>
                  <td className="px-3 py-2 break-all">
                    <ProductIds
                      productId={issue.productId}
                      claimedProductId={issue.claimedProductId}
                    />
                  </td>
                  <td className="px-3 py-2">{issue.count}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatUtcDateTime(issue.firstSeenAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatUtcDateTime(issue.lastSeenAt)}
                  </td>
                  <td className="px-3 py-2">{issue.environment ?? "—"}</td>
                  <td className="px-3 py-2">
                    {issue.retryAfterSec !== undefined
                      ? `${issue.retryAfterSec} s`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs break-all">
                    {issue.correlationId ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {issue.fingerprint.slice(0, FINGERPRINT_PREFIX)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {issues.status === "CanLoadMore" ? (
        <button
          type="button"
          onClick={() => issues.loadMore(25)}
          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {"Load more"}
        </button>
      ) : null}

      <IssueDetail
        projectId={project._id}
        issueId={issueId}
        base={base}
        onClose={() => setParam("issue", null)}
      />
    </div>
  );
}

function ProductIds({
  productId,
  claimedProductId,
}: {
  productId?: string;
  claimedProductId?: string;
}) {
  if (!productId && !claimedProductId) return <>{"—"}</>;
  return (
    <>
      {productId ? <div>{productId}</div> : null}
      {claimedProductId && claimedProductId !== productId ? (
        <div className="text-xs text-muted-foreground">
          {`claimed ${claimedProductId}`}
        </div>
      ) : null}
    </>
  );
}

function IssueDetail({
  projectId,
  issueId,
  base,
  onClose,
}: {
  projectId: Id<"projects">;
  issueId: string | null;
  base: string;
  onClose: () => void;
}) {
  const issue = useQuery(
    api.purchaseIssues.query.getPurchaseIssue,
    issueId ? { projectId, issueId } : "skip",
  );
  return (
    <Modal
      isOpen={issueId !== null}
      onClose={onClose}
      ariaLabel="Purchase issue"
      className="bg-card"
      contentClassName="p-5"
    >
      {issue === undefined ? (
        <LoadingSpinner size="sm" />
      ) : issue === null ? (
        <p className="pr-8 text-sm">
          {"This issue no longer exists. Issues are kept for 30 days."}
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="pr-8">
            <div className="flex flex-wrap items-center gap-2 font-semibold">
              {PURCHASE_ISSUE_CAUSES[issue.cause].label}
              <Badge variant="outline" size="xs">
                {issue.cause}
              </Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {PURCHASE_ISSUE_CAUSES[issue.cause].meaning}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              {"Next step"}
            </div>
            <p className="mt-1">
              {PURCHASE_ISSUE_CAUSES[issue.cause].nextStep}
            </p>
          </div>
          <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <Field label="Store">{issue.store}</Field>
            <Field label="Verified product">{issue.productId}</Field>
            <Field label="Claimed product">{issue.claimedProductId}</Field>
            <Field label="App user">
              {issue.appUserId ? (
                <Link
                  to={`${base}/purchases/user/${encodeURIComponent(issue.appUserId)}`}
                  className="text-primary hover:underline"
                >
                  {issue.appUserId}
                </Link>
              ) : undefined}
            </Field>
            <Field label="Environment">{issue.environment}</Field>
            <Field label="Count">{issue.count}</Field>
            <Field label="First seen">
              {formatUtcDateTime(issue.firstSeenAt)}
            </Field>
            <Field label="Last seen">
              {formatUtcDateTime(issue.lastSeenAt)}
            </Field>
            <Field label="Retry after">
              {issue.retryAfterSec !== undefined
                ? `${issue.retryAfterSec} s`
                : undefined}
            </Field>
            <Field label="Correlation ID">{issue.correlationId}</Field>
            <Field label="Fingerprint">{issue.fingerprint}</Field>
          </dl>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all font-mono">{children ?? "—"}</dd>
    </>
  );
}
