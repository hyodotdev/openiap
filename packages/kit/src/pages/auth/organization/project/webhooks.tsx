import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { Webhook, Copy, ExternalLink } from "lucide-react";

import type { Doc } from "@/convex";

type ProjectContext = { project: Doc<"projects"> };

export default function ProjectWebhooks() {
  const { project } = useOutletContext<ProjectContext>();
  const baseUrl = window.location.origin;

  const urls = {
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
          Register the URLs below with App Store Connect and Google Pub/Sub so
          kit can ingest lifecycle notifications. Clients connect to the SSE
          stream URL to receive normalized{" "}
          <code className="text-xs">WebhookEvent</code>s in real time.
        </p>
      </div>

      <UrlCard
        title="Apple App Store Server Notifications v2"
        description={
          <>
            Paste this URL into App Store Connect → Apps → Your App → App
            Information → App Store Server Notifications. Production + Sandbox
            URLs are the same — kit reads the environment from the signed
            payload.
          </>
        }
        url={urls.apple}
        external="https://developer.apple.com/documentation/appstoreservernotifications"
      />

      <UrlCard
        title="Google Play Real-Time Developer Notifications"
        description={
          <>
            Configure a Pub/Sub topic in Google Cloud, attach a push
            subscription pointing at this URL, and grant the topic publish
            permission to your Play Console publisher account. kit verifies the
            OIDC bearer token; set{" "}
            <code className="text-xs">GOOGLE_PUBSUB_PUSH_AUDIENCE</code> in your
            kit deployment to enable strict checks.
          </>
        }
        url={urls.google}
        external="https://developer.android.com/google/play/billing/rtdn-reference"
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
          </>
        }
        url={urls.stream}
      />

      <div className="border border-border rounded-lg bg-card p-4 text-sm space-y-2">
        <div className="font-medium">Live test</div>
        <p className="text-xs text-muted-foreground">
          POST a synthetic Pub/Sub test message to the Google receiver to verify
          wiring without going through the App Store / Play Console. The MCP
          server's <code className="text-xs">openiap_simulate_webhook</code>{" "}
          tool runs this same request.
        </p>
        <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto">{`curl -X POST \\
  ${urls.google} \\
  -H 'content-type: application/json' \\
  -d '{
    "message": {
      "data": "${btoa(JSON.stringify({ packageName: project.androidPackageName ?? "com.example.app", eventTimeMillis: Date.now(), testNotification: { version: "1.0" } }))}",
      "messageId": "manual-test-${Date.now()}",
      "publishTime": "${new Date().toISOString()}"
    }
  }'`}</pre>
      </div>
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
