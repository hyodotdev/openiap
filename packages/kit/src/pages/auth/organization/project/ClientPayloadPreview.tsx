import { CheckCircle2, XCircle } from "lucide-react";

import { buildPublicClientPayloadResponse } from "../../../../../convex/products/clientPayloadHttp";
import {
  diffLines,
  formatClientPayloadBytes,
  type ClientPayloadFormat,
  type ClientPayloadSdkPreview,
  type ClientPayloadValidationResult,
  type ProductClientPayload,
} from "./clientPayload";

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  304: "Not Modified",
  404: "Not Found",
};

interface ClientPayloadPreviewProps {
  draft: { format: ClientPayloadFormat; body: string };
  draftValidation: ClientPayloadValidationResult;
  nextVersion: number;
  platform: "IOS" | "Android";
  productId: string;
  published?: ProductClientPayload;
  sdkPreview: ClientPayloadSdkPreview | null | undefined;
}

/** Draft vs published, their diff, and the exact response an app receives. */
export function ClientPayloadPreview({
  draft,
  draftValidation,
  nextVersion,
  platform,
  productId,
  published,
  sdkPreview,
}: ClientPayloadPreviewProps) {
  const changed =
    !published ||
    published.format !== draft.format ||
    published.body !== draft.body;
  const diff = diffLines(published?.body ?? "", draft.body);

  return (
    <div className="space-y-4 text-xs">
      <div className="grid gap-3 md:grid-cols-2">
        <PayloadColumn
          title={published ? `Published · v${published.version}` : "Published"}
          format={published?.format}
          body={published?.body}
          emptyText="Nothing is published yet."
        />
        <PayloadColumn
          title="Draft"
          format={draft.format}
          body={draft.body}
          emptyText="The draft is empty."
          validation={draftValidation}
        />
      </div>

      <section aria-label="Changes" className="min-w-0">
        <h3 className="mb-1 font-medium">Changes</h3>
        {changed ? (
          <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono leading-5 whitespace-pre-wrap break-all">
            {published && published.format !== draft.format ? (
              <span className="block text-muted-foreground">
                format: {published.format} → {draft.format}
              </span>
            ) : null}
            {diff.map((line, index) => (
              <span
                key={index}
                className={
                  line.type === "add"
                    ? "block bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : line.type === "remove"
                      ? "block bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "block text-muted-foreground"
                }
              >
                {line.type === "add"
                  ? "+ "
                  : line.type === "remove"
                    ? "- "
                    : "  "}
                {line.text}
              </span>
            ))}
          </pre>
        ) : (
          <p className="text-muted-foreground">
            The draft matches the published payload.
          </p>
        )}
      </section>

      <section aria-label="What the SDK receives" className="min-w-0 space-y-2">
        <h3 className="font-medium">What the SDK receives</h3>
        {sdkPreview === undefined ? (
          <p className="text-muted-foreground">Loading the app response…</p>
        ) : sdkPreview === null ? (
          <p className="text-muted-foreground">
            Create a publishable API key to preview the exact response apps
            receive.
          </p>
        ) : (
          <>
            <p className="break-all font-mono text-muted-foreground">
              {`GET /v1/products/${sdkPreview.keyPreview}/${encodeURIComponent(productId)}/client-payload?platform=${platform}`}
            </p>
            <HttpBlock title="Now" response={sdkPreview.response} />
            {sdkPreview.response.status === 404 && published ? (
              <p className="text-muted-foreground">
                Apps get 404 while the catalog product is Draft, Removed, or
                missing, even though a payload is published.
              </p>
            ) : changed && draftValidation.valid ? (
              <HttpBlock
                title={`After publish · v${nextVersion}`}
                caption="updatedAt is set when you publish."
                response={buildPublicClientPayloadResponse(
                  {
                    status: "found",
                    clientPayload: {
                      format: draft.format,
                      body: draft.body,
                      version: nextVersion,
                      updatedAt: Date.now(),
                    },
                  },
                  sdkPreview.etagScope,
                )}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function PayloadColumn({
  title,
  format,
  body,
  emptyText,
  validation,
}: {
  title: string;
  format?: ClientPayloadFormat;
  body?: string;
  emptyText: string;
  validation?: ClientPayloadValidationResult;
}) {
  return (
    <section aria-label={title} className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        {format ? (
          <span className="text-muted-foreground">
            {format.toUpperCase()}
            {body
              ? ` · ${formatClientPayloadBytes(new TextEncoder().encode(body).byteLength)}`
              : ""}
          </span>
        ) : null}
      </div>
      {body ? (
        <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono leading-5 whitespace-pre-wrap break-all">
          {body}
        </pre>
      ) : (
        <p className="text-muted-foreground">{emptyText}</p>
      )}
      {validation ? (
        validation.valid ? (
          <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Valid {format?.toUpperCase()}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-rose-600 dark:text-rose-300">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {validation.error}
          </p>
        )
      ) : null}
    </section>
  );
}

function HttpBlock({
  title,
  caption,
  response,
}: {
  title: string;
  caption?: string;
  response: ClientPayloadSdkPreview["response"];
}) {
  const text = [
    `HTTP/1.1 ${response.status} ${STATUS_TEXT[response.status] ?? ""}`.trim(),
    ...Object.entries(response.headers).map(
      ([name, value]) => `${name}: ${value}`,
    ),
    "",
    response.body,
  ].join("\n");
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground">
        {title}
        {caption ? ` · ${caption}` : ""}
      </p>
      <pre
        aria-label={`${title} response`}
        className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono leading-5 whitespace-pre-wrap break-all"
      >
        {text}
      </pre>
    </div>
  );
}
