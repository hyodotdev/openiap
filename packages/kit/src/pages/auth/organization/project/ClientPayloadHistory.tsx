import { useState } from "react";
import { History, Loader2 } from "lucide-react";

import {
  formatClientPayloadBytes,
  type ClientPayloadVersion,
  type ClientPayloadVersionSummary,
} from "./clientPayload";

interface ClientPayloadHistoryProps {
  canEdit: boolean;
  currentVersion?: number;
  history: ClientPayloadVersionSummary[] | undefined;
  isBusy: boolean;
  onRollback: (version: number) => Promise<void>;
  onSelect: (version: number) => void;
  selected: ClientPayloadVersion | null | undefined;
  selectedVersion?: number;
}

const ACTION_LABEL: Record<ClientPayloadVersionSummary["action"], string> = {
  publish: "Published",
  rollback: "Rolled back",
  remove: "Removed",
};

/** Retained published versions, newest first, with rollback for admins. */
export function ClientPayloadHistory({
  canEdit,
  currentVersion,
  history,
  isBusy,
  onRollback,
  onSelect,
  selected,
  selectedVersion,
}: ClientPayloadHistoryProps) {
  const [confirmingVersion, setConfirmingVersion] = useState<number>();

  if (history === undefined) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Loading history…
      </p>
    );
  }
  if (history.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No published versions yet. Each publish, rollback, and removal is
        recorded here.
      </p>
    );
  }

  const canRollBack =
    canEdit &&
    selected?.body !== undefined &&
    selected.version !== currentVersion;

  return (
    <div className="space-y-3 text-xs">
      <ul className="max-h-48 divide-y divide-border overflow-auto rounded-md border border-border">
        {history.map((entry) => (
          <li key={entry.version}>
            <button
              type="button"
              aria-pressed={entry.version === selectedVersion}
              onClick={() => {
                setConfirmingVersion(undefined);
                onSelect(entry.version);
              }}
              className={`flex w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-left hover:bg-muted/50 ${
                entry.version === selectedVersion ? "bg-muted/60" : ""
              }`}
            >
              <span className="font-mono font-medium">v{entry.version}</span>
              <span>
                {ACTION_LABEL[entry.action]}
                {entry.rolledBackFrom !== undefined
                  ? ` from v${entry.rolledBackFrom}`
                  : ""}
                {entry.version === currentVersion ? " · live" : ""}
              </span>
              <span className="text-muted-foreground">
                {entry.author?.name ??
                  (entry.author?.type === "apiKey"
                    ? "API key"
                    : "Unknown")}{" "}
                · {new Date(entry.createdAt).toLocaleString()}
                {entry.byteLength !== undefined
                  ? ` · ${formatClientPayloadBytes(entry.byteLength)}`
                  : ""}
              </span>
              {entry.note ? (
                <span className="w-full min-w-0 break-words text-muted-foreground">
                  {entry.note}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {selectedVersion === undefined ? (
        <p className="text-muted-foreground">
          Select a version to see its body.
        </p>
      ) : selected === undefined ? (
        <p role="status" className="text-muted-foreground">
          Loading v{selectedVersion}…
        </p>
      ) : selected === null ? (
        <p className="text-muted-foreground">
          v{selectedVersion} is no longer retained.
        </p>
      ) : (
        <section
          aria-label={`Version ${selected.version}`}
          className="space-y-2"
        >
          {selected.body !== undefined ? (
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono leading-5 whitespace-pre-wrap break-all">
              {selected.body}
            </pre>
          ) : (
            <p className="text-muted-foreground">
              This entry removed the payload; it has no body to restore.
            </p>
          )}
          {canRollBack ? (
            confirmingVersion === selected.version ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3"
              >
                <p className="min-w-0">
                  Publish v{selected.version}&apos;s body as a new version? Apps
                  receive it on their next refresh.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmingVersion(undefined)}
                    className="rounded border border-border px-3 py-1.5 hover:bg-muted/50 disabled:opacity-60"
                  >
                    Keep current
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onRollback(selected.version)}
                    className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Confirm rollback
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setConfirmingVersion(selected.version)}
                className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 hover:bg-muted/50 disabled:opacity-60"
              >
                <History className="h-3.5 w-3.5" />
                Roll back to v{selected.version}
              </button>
            )
          ) : null}
        </section>
      )}
    </div>
  );
}
