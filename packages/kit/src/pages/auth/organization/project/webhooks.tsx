import { useOutletContext, useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "convex/react";
import {
  Webhook,
  Copy,
  ExternalLink,
  Check,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

import type { Doc } from "@/convex";
import { api } from "@/convex";

type ProjectContext = { project: Doc<"projects"> };

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
    apiKey: project.apiKey,
  });

  const urls = {
    unified: `${baseUrl}/v1/webhooks/${encodeURIComponent(project.apiKey)}`,
    apple: `${baseUrl}/v1/webhooks/apple/${encodeURIComponent(project.apiKey)}`,
    google: `${baseUrl}/v1/webhooks/google/${encodeURIComponent(project.apiKey)}`,
    stream: `${baseUrl}/v1/webhooks/stream/${encodeURIComponent(project.apiKey)}`,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <Webhook className="w-5 h-5" />
          Webhooks
        </h2>
        <p className="text-sm text-muted-foreground">
          One URL covers Apple ASN v2 and Google Pub/Sub RTDN — kit inspects the
          payload shape and routes internally. Clients connect to the SSE stream
          URL to receive normalized{" "}
          <code className="text-xs">WebhookEvent</code>s in real time. Platforms
          you haven't configured simply produce no traffic; if a notification
          arrives for an unconfigured platform, kit returns a precise{" "}
          <code className="text-xs">IOS_NOT_CONFIGURED</code> /{" "}
          <code className="text-xs">ANDROID_NOT_CONFIGURED</code> error so you
          know exactly what's missing.
        </p>
      </div>

      {setup ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            label="Horizon (polling)"
            configured={setup.horizon.configured}
            missing={setup.horizon.missing}
            settingsHref={settingsHref}
          />
        </div>
      ) : null}

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
                Google Cloud Pub/Sub → Subscription → Push endpoint (then point
                Play Console → Monetization setup → RTDN at the topic).
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
              expected). Verify wiring with the curl recipe below or with App
              Store Connect's "Send Test Notification" button.{" "}
              <a
                href="https://www.openiap.dev/docs/webhooks#setup"
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
        url={urls.unified}
        external="https://developer.apple.com/documentation/appstoreservernotifications"
      />

      <UrlCard
        title="Real-time SSE stream"
        description={
          <>
            Open this URL with EventSource (or kit's per-SDK helper) to receive
            normalized webhook events. Reconnects are handled automatically
            using <code className="text-xs">Last-Event-ID</code> so events fired
            during a closed connection are delivered in order on the next
            connect.
            <span className="block mt-2 text-xs text-amber-500">
              Long-lived <code className="text-xs">text/event-stream</code>{" "}
              response — opening it in a browser shows a blank tab (expected).
              Test it with{" "}
              <code className="text-xs">curl -N {urls.stream}</code> or wire one
              of the per-SDK hooks at{" "}
              <a
                href="https://www.openiap.dev/docs/webhooks#consume-stream"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                openiap.dev/docs/webhooks
              </a>
              .
            </span>
          </>
        }
        url={urls.stream}
      />

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
            url={urls.apple}
          />
          <UrlCard
            title="Google-only"
            description="Accepts Pub/Sub envelopes only."
            url={urls.google}
          />
        </div>
      </details>

      <div className="border border-border rounded-lg bg-card p-4 text-sm space-y-2">
        <div className="font-medium">Live test</div>
        <p className="text-xs text-muted-foreground">
          POST a synthetic Pub/Sub test message to the unified URL to verify
          wiring without going through the App Store / Play Console. The MCP
          server's <code className="text-xs">openiap_simulate_webhook</code>{" "}
          tool runs this same request.
        </p>
        <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">{`curl -X POST \\
  ${urls.unified} \\
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
    </div>
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
