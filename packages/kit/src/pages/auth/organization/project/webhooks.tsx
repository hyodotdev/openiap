import { useOutletContext, useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Webhook,
  Copy,
  ExternalLink,
  Check,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";
import { PageLoading } from "@/components/LoadingSpinner";
import { COMMERCE_EVENT_TYPES } from "../../../../../convex/commerce/contract";

type ProjectContext = {
  project: Omit<
    Doc<"projects">,
    "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
  >;
};

export default function ProjectWebhooks() {
  const { project } = useOutletContext<ProjectContext>();
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const settingsHref =
    orgSlug && projectSlug
      ? `/${orgSlug}/project/${projectSlug}/settings`
      : null;
  const baseUrl = window.location.origin;
  const setup = useQuery(api.projects.setupStatus.getSetupStatus, {
    projectId: project._id,
  });
  const endpointPaths = useQuery(api.projects.query.getWebhookEndpointPaths, {
    projectId: project._id,
  });

  if (endpointPaths === undefined) {
    return <PageLoading />;
  }

  const lifecycleUrls =
    endpointPaths?.unified && endpointPaths.apple && endpointPaths.google
      ? {
          unified: `${baseUrl}${endpointPaths.unified}`,
          apple: `${baseUrl}${endpointPaths.apple}`,
          google: `${baseUrl}${endpointPaths.google}`,
        }
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Webhook className="w-5 h-5" />
          Webhooks
        </h2>
        <p className="text-sm text-muted-foreground">
          One URL covers Apple ASN v2 and Google Pub/Sub RTDN — kit inspects the
          payload shape, validates it, stores the lifecycle transition, and
          updates subscription state internally. Platforms you haven't
          configured simply produce no traffic; if a notification arrives for an
          unconfigured platform, kit returns a precise{" "}
          <code className="text-xs">IOS_NOT_CONFIGURED</code> /{" "}
          <code className="text-xs">ANDROID_NOT_CONFIGURED</code> error so you
          know exactly what's missing.
        </p>
      </div>

      {setup ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <SetupBadge
            label="iOS"
            configured={setup.ios.configured}
            missing={setup.ios.missing}
            settingsHref={settingsHref}
          />
          <SetupBadge
            label="Android"
            configured={setup.android.configured}
            missing={setup.android.missing}
            settingsHref={settingsHref}
          />
          <SetupBadge
            label="Horizon REST"
            configured={setup.horizon.configured}
            missing={setup.horizon.missing}
            settingsHref={settingsHref}
          />
          <SetupBadge
            label="Amazon RVS"
            configured={setup.amazon.configured}
            missing={setup.amazon.missing}
            settingsHref={settingsHref}
          />
        </div>
      ) : null}

      {lifecycleUrls ? (
        <UrlCard
          title="Lifecycle webhook URL (Apple + Google)"
          description={
            <>
              Paste this URL into <strong>both</strong>:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  App Store Connect → Apps → Your App → App Information → App
                  Store Server Notifications (Production + Sandbox).
                </li>
                <li>
                  Google Cloud Pub/Sub → Subscription → Push endpoint (then
                  point Play Console → Monetization setup → RTDN at the topic).
                  Select the same service account whose JSON is uploaded in this
                  project as the push authentication identity and keep the OIDC
                  audience equal to this exact lifecycle URL. Update existing
                  subscriptions that use a different push identity. Grant the
                  Pub/Sub service agent{" "}
                  <code className="text-xs">
                    service-$&#123;PROJECT_NUMBER&#125;@gcp-sa-pubsub.iam.gserviceaccount.com
                  </code>{" "}
                  <code className="text-xs">
                    roles/iam.serviceAccountTokenCreator
                  </code>{" "}
                  and give the subscription operator{" "}
                  <code className="text-xs">roles/iam.serviceAccountUser</code>{" "}
                  on that account.
                </li>
              </ul>
              <span className="block mt-2 text-xs">
                kit auto-detects the payload shape and dispatches to the right
                verifier — Apple notifications signed with your{" "}
                <code className="text-xs">.p8</code> + Google Pub/Sub messages
                with OIDC bearer.
              </span>
              <span className="block mt-2 text-xs text-amber-500">
                POST-only — opening this URL in a browser returns 404 (that's
                expected). Verify production wiring with App Store Connect's
                "Send Test Notification" or Google Pub/Sub's authenticated push
                delivery.{" "}
                <a
                  href="https://openiap.dev/docs/webhooks#setup"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  Full setup guide
                </a>
                .
              </span>
            </>
          }
          url={lifecycleUrls.unified}
          external="https://developer.apple.com/documentation/appstoreservernotifications"
        />
      ) : (
        <div className="border border-border rounded-lg bg-card p-4 text-sm">
          <div className="font-medium">Webhook endpoints unavailable</div>
          <p className="text-xs text-muted-foreground mt-1">
            Create or activate a publishable API key, or ask an admin to view
            webhook endpoints.
          </p>
        </div>
      )}

      {lifecycleUrls ? (
        <details className="border border-border rounded-lg bg-card">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium">
            Advanced — platform-specific URLs (legacy)
          </summary>
          <div className="border-t border-border p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              These URLs accept only the matching platform's payload. Use the
              unified URL above unless an upstream tool insists on a
              store-prefixed path.
            </p>
            <UrlCard
              title="Apple-only"
              description="Accepts ASN v2 signedPayload bodies only."
              url={lifecycleUrls.apple}
            />
            <UrlCard
              title="Google-only"
              description="Accepts Pub/Sub envelopes only."
              url={lifecycleUrls.google}
            />
          </div>
        </details>
      ) : null}

      <CommerceDestinations projectId={project._id} />

      {lifecycleUrls ? (
        <div className="border border-border rounded-lg bg-card p-4 text-sm space-y-2">
          <div className="font-medium">Local/dev receiver smoke test</div>
          <p className="text-xs text-muted-foreground">
            POST a synthetic Pub/Sub test message to the unified URL only on
            local/dev deployments with{" "}
            <code className="text-xs">KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1</code>.
            Set it on both the Bun receiver and the selected Convex dev
            deployment. Hosted production Google RTDN requires project-bound
            Pub/Sub OIDC; use the store-console test notification buttons there.
          </p>
          <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">{`curl -X POST \\
  ${lifecycleUrls.unified} \\
  -H 'content-type: application/json' \\
  -d '{
    "message": {
      "data": "${btoa(
        JSON.stringify({
          packageName: project.androidPackageName ?? "com.example.app",
          eventTimeMillis: Date.now(),
          testNotification: { version: "1.0" },
        }),
      )}",
      "messageId": "manual-test-${Date.now()}",
      "publishTime": "${new Date().toISOString()}"
    }
  }'`}</pre>
        </div>
      ) : null}
    </div>
  );
}

function CommerceDestinations({
  projectId,
}: {
  projectId: Doc<"projects">["_id"];
}) {
  const canManage = useQuery(api.commerce.destinations.canManage, {
    projectId,
  });
  const destinations = useQuery(
    api.commerce.destinations.list,
    canManage ? { projectId } : "skip",
  );
  const failed = useQuery(
    api.commerce.deliveryState.listFailed,
    canManage ? { projectId } : "skip",
  );
  const createDestination = useMutation(api.commerce.destinations.create);
  const updateDestination = useMutation(api.commerce.destinations.update);
  const rotateSecret = useMutation(api.commerce.destinations.rotateSecret);
  const removeDestination = useMutation(api.commerce.destinations.remove);
  const replayDelivery = useMutation(api.commerce.deliveryState.replay);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([
    ...COMMERCE_EVENT_TYPES,
  ]);
  const [filterDrafts, setFilterDrafts] = useState<Record<string, string[]>>(
    {},
  );
  const [revealedSecrets, setRevealedSecrets] = useState<
    Record<string, { secret: string; destination: string }>
  >({});
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const submittedUrl = url;
      const result = await createDestination({
        projectId,
        url: submittedUrl,
        ...(description ? { description } : {}),
        ...(eventTypes.length < COMMERCE_EVENT_TYPES.length
          ? { eventTypes }
          : {}),
      });
      setRevealedSecrets((current) => ({
        ...current,
        [result.destinationId]: {
          secret: result.secret,
          destination: submittedUrl,
        },
      }));
      setUrl("");
      setDescription("");
      setEventTypes([...COMMERCE_EVENT_TYPES]);
      toast.success("Outbound destination created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (canManage === undefined) {
    return null;
  }

  if (!canManage) {
    return (
      <section className="border border-border rounded-lg bg-card p-4">
        <h3 className="font-medium">Developer backend delivery</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          An organization owner or admin can manage signed HTTPS destinations.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border rounded-lg bg-card p-4 space-y-4">
      <div>
        <h3 className="font-medium">Developer backend delivery</h3>
        <p className="text-xs text-muted-foreground mt-1">
          IAPKit can send signed, normalized subscription and entitlement events
          to your HTTPS backend. Delivery runs in a bounded Convex worker; it is
          never a mobile event stream or part of the Fly request path.
        </p>
      </div>

      <form onSubmit={(event) => void create(event)} className="space-y-2">
        <label className="block text-xs font-medium" htmlFor="commerce-url">
          HTTPS destination
        </label>
        <input
          id="commerce-url"
          type="url"
          required
          maxLength={2_048}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://api.example.com/webhooks/openiap"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <details className="rounded border border-border p-2 text-xs">
          <summary className="cursor-pointer font-medium">
            Event filter{" "}
            {eventTypes.length === COMMERCE_EVENT_TYPES.length
              ? "(all events)"
              : `(${eventTypes.length})`}
          </summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {COMMERCE_EVENT_TYPES.map((eventType) => (
              <label key={eventType} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Receive ${eventType}`}
                  checked={eventTypes.includes(eventType)}
                  disabled={
                    eventTypes.length === 1 && eventTypes.includes(eventType)
                  }
                  onChange={(event) =>
                    setEventTypes((current) =>
                      event.target.checked
                        ? [...current, eventType]
                        : current.filter((value) => value !== eventType),
                    )
                  }
                />
                <code>{eventType}</code>
              </label>
            ))}
          </div>
        </details>
        <input
          aria-label="Destination description"
          maxLength={512}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional description"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Add destination
        </button>
      </form>

      {Object.entries(revealedSecrets).map(
        ([destinationId, revealedSecret]) => (
          <div
            key={destinationId}
            className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2"
          >
            <div className="font-medium">Copy this signing secret now</div>
            <p>It is shown once and cannot be retrieved later.</p>
            <p className="break-all font-mono">{revealedSecret.destination}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all">
                {revealedSecret.secret}
              </code>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(revealedSecret.secret)
                }
                className="rounded bg-background px-2 py-1"
              >
                Copy
              </button>
              <button
                type="button"
                aria-label={`Dismiss signing secret for ${revealedSecret.destination}`}
                onClick={() =>
                  setRevealedSecrets((current) => {
                    const next = { ...current };
                    delete next[destinationId];
                    return next;
                  })
                }
                className="rounded bg-background px-2 py-1"
              >
                Done
              </button>
            </div>
          </div>
        ),
      )}

      <div className="space-y-2">
        {(destinations ?? []).map((destination) => {
          const storedEventTypes = destination.eventTypes?.length
            ? destination.eventTypes
            : [...COMMERCE_EVENT_TYPES];
          const draftEventTypes =
            filterDrafts[destination._id] ?? storedEventTypes;
          return (
            <div
              key={destination._id}
              className="rounded border border-border p-3 text-xs space-y-2"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="break-all font-mono">{destination.url}</div>
                  {destination.description ? (
                    <div className="text-muted-foreground mt-1">
                      {destination.description}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void updateDestination({
                      destinationId: destination._id,
                      enabled: !destination.enabled,
                    }).catch((error) =>
                      toast.error(
                        error instanceof Error ? error.message : String(error),
                      ),
                    )
                  }
                  className="rounded border border-border px-2 py-1"
                >
                  {destination.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  aria-label={`Rotate signing secret for ${destination.url}`}
                  onClick={() =>
                    void rotateSecret({ destinationId: destination._id })
                      .then((result) =>
                        setRevealedSecrets((current) => ({
                          ...current,
                          [destination._id]: {
                            secret: result.secret,
                            destination: destination.url,
                          },
                        })),
                      )
                      .catch((error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                  }
                  className="rounded border border-border p-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove destination ${destination.url}`}
                  onClick={() => {
                    if (!window.confirm("Remove this destination?")) return;
                    void removeDestination({
                      destinationId: destination._id,
                    }).catch((error) =>
                      toast.error(
                        error instanceof Error ? error.message : String(error),
                      ),
                    );
                  }}
                  className="rounded border border-destructive/40 p-1.5 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-muted-foreground">
                {destination.enabled ? "Enabled" : "Disabled"} ·{" "}
                {destination.consecutiveFailures} consecutive failures
              </div>
              <div className="break-words text-muted-foreground">
                {destination.eventTypes?.length
                  ? destination.eventTypes.join(", ")
                  : "All events"}
              </div>
              <details className="rounded border border-border p-2">
                <summary className="cursor-pointer font-medium">
                  Edit event filter
                </summary>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {COMMERCE_EVENT_TYPES.map((eventType) => {
                    const selected = draftEventTypes.includes(eventType);
                    return (
                      <label
                        key={eventType}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          aria-label={`${destination.url} receive ${eventType}`}
                          checked={selected}
                          disabled={draftEventTypes.length === 1 && selected}
                          onChange={(event) => {
                            setFilterDrafts((current) => {
                              const values =
                                current[destination._id] ?? storedEventTypes;
                              const next = event.target.checked
                                ? [...new Set([...values, eventType])]
                                : values.filter((value) => value !== eventType);
                              return { ...current, [destination._id]: next };
                            });
                          }}
                        />
                        <code>{eventType}</code>
                      </label>
                    );
                  })}
                </div>
                {draftEventTypes.length === 1 ? (
                  <p className="mt-2 text-muted-foreground">
                    Disable the destination to stop its final event type.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={filterDrafts[destination._id] === undefined}
                  onClick={() =>
                    void updateDestination({
                      destinationId: destination._id,
                      eventTypes:
                        draftEventTypes.length === COMMERCE_EVENT_TYPES.length
                          ? []
                          : draftEventTypes,
                    })
                      .then(() =>
                        setFilterDrafts((current) => {
                          const next = { ...current };
                          delete next[destination._id];
                          return next;
                        }),
                      )
                      .catch((error) =>
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        ),
                      )
                  }
                  className="mt-2 rounded border border-border px-2 py-1 disabled:opacity-50"
                >
                  Save event filter
                </button>
              </details>
            </div>
          );
        })}
        {destinations?.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No outbound destinations yet.
          </p>
        ) : null}
      </div>

      {(failed ?? []).length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Dead letters</h4>
          {failed?.map((delivery) => (
            <div
              key={delivery._id}
              className="flex items-center gap-2 rounded border border-border p-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div>{delivery.eventType}</div>
                <div className="truncate text-muted-foreground">
                  {delivery.destinationUrl} ·{" "}
                  {[
                    delivery.lastStatusCode
                      ? `HTTP ${delivery.lastStatusCode}`
                      : null,
                    delivery.lastError,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "failed"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  void replayDelivery({ deliveryId: delivery._id }).catch(
                    (error) =>
                      toast.error(
                        error instanceof Error ? error.message : String(error),
                      ),
                  )
                }
                className="rounded border border-border px-2 py-1"
              >
                Replay
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SetupBadge({
  label,
  configured,
  missing,
  settingsHref,
}: {
  label: string;
  configured: boolean;
  missing: string[];
  settingsHref: string | null;
}) {
  return (
    <div className="border border-border rounded-lg bg-card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        {configured ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        {label}
        <span
          className={`ml-auto text-xs ${configured ? "text-green-500" : "text-amber-500"}`}
        >
          {configured ? "Ready" : "Not configured"}
        </span>
      </div>
      {!configured && missing.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Missing: {missing.join(", ")}
        </div>
      )}
      {!configured && settingsHref && (
        <Link
          to={settingsHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline self-start"
        >
          Configure now <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

function UrlCard({
  title,
  description,
  url,
  external,
}: {
  title: string;
  description: React.ReactNode;
  url: string;
  external?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {description}
          </div>
        </div>
        {external && (
          <a
            href={external}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Apple/Google docs
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 bg-muted/40 rounded p-2">
        <code className="flex-1 text-xs font-mono break-all">{url}</code>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1_500);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-background hover:bg-muted"
        >
          <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
