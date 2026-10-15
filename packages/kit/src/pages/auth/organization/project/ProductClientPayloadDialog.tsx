import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { api, type Id } from "@/convex";
import {
  closeProductClientPayloadEditor,
  productClientPayloadEditorSignal,
} from "@/lib/signals";
import { ClientPayloadHistory } from "./ClientPayloadHistory";
import { ClientPayloadPreview } from "./ClientPayloadPreview";
import {
  MAX_CLIENT_PAYLOAD_BODY_BYTES,
  formatClientPayloadBytes,
  validateClientPayload,
  type ClientPayloadDraft,
  type ClientPayloadFormat,
  type ClientPayloadSdkPreview,
  type ClientPayloadVersion,
  type ClientPayloadVersionSummary,
  type ProductClientPayload,
} from "./clientPayload";

export type ClientPayloadTab = "preview" | "history";

export type ClientPayloadProduct = {
  clientPayload?: ProductClientPayload;
  draft?: ClientPayloadDraft;
  expectedDraftRevision: number;
  expectedVersion: number;
  projectId?: Id<"projects">;
  platform: "IOS" | "Android";
  productId: string;
  title: string;
};

type Target = { platform: "IOS" | "Android"; productId: string };
export type SaveDraftInput = Target & {
  body: string;
  expectedDraftRevision: number;
  format: ClientPayloadFormat;
};
export type PublishInput = Target & {
  expectedDraftRevision: number;
  expectedVersion: number;
  note?: string;
};
export type DiscardDraftInput = Target & { expectedDraftRevision: number };
export type RemoveClientPayloadInput = Target & { expectedVersion: number };
export type RollbackInput = Target & {
  expectedVersion: number;
  toVersion: number;
};

interface ProductClientPayloadDialogProps {
  history: ClientPayloadVersionSummary[] | undefined;
  isLoading?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDiscardDraft: (input: DiscardDraftInput) => Promise<void>;
  onPublish: (input: PublishInput) => Promise<void>;
  onRemove: (input: RemoveClientPayloadInput) => Promise<void>;
  onRollback: (input: RollbackInput) => Promise<void>;
  onSaveDraft: (
    input: SaveDraftInput,
  ) => Promise<{ revision: number; baseVersion: number }>;
  onSelectVersion: (version: number) => void;
  onTabChange: (tab: ClientPayloadTab) => void;
  product: ClientPayloadProduct | null;
  sdkPreview: ClientPayloadSdkPreview | null | undefined;
  selectedVersion?: number;
  selectedVersionDetail: ClientPayloadVersion | null | undefined;
  tab: ClientPayloadTab;
}

type Snapshot = {
  draftRevision: number;
  expectedVersion: number;
  published?: ProductClientPayload;
  savedDraft?: ClientPayloadDraft;
};

type BusyAction = "save" | "publish" | "discard" | "remove" | "rollback";

const FORMAT_OPTIONS: Array<{
  label: string;
  value: ClientPayloadFormat;
}> = [
  { value: "toml", label: "TOML" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Plain text" },
];

const EMPTY_SNAPSHOT: Snapshot = { draftRevision: 0, expectedVersion: 0 };

export function ProductClientPayloadDialog({
  history,
  isLoading = false,
  isOpen,
  onClose,
  onDiscardDraft,
  onPublish,
  onRemove,
  onRollback,
  onSaveDraft,
  onSelectVersion,
  onTabChange,
  product,
  sdkPreview,
  selectedVersion,
  selectedVersionDetail,
  tab,
}: ProductClientPayloadDialogProps) {
  const [format, setFormat] = useState<ClientPayloadFormat>("toml");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const initializedTargetRef = useRef<string | null>(null);
  const keepPayloadButtonRef = useRef<HTMLButtonElement>(null);
  const removePayloadButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRemoveRef = useRef(false);
  const payloadFieldId = useId();

  useEffect(() => {
    if (!isOpen || !product) {
      if (!isOpen) initializedTargetRef.current = null;
      return;
    }
    const targetKey = `${product.projectId ?? "unknown-project"}\u0000${product.platform}\u0000${product.productId}`;
    if (isLoading || initializedTargetRef.current === targetKey) return;

    // Snapshot once per opened target. A reactive update from another tab
    // must not overwrite these edits or silently advance the OCC guards.
    initializedTargetRef.current = targetKey;
    const start = product.draft ?? product.clientPayload;
    setSnapshot({
      draftRevision: product.expectedDraftRevision,
      expectedVersion: product.expectedVersion,
      published: product.clientPayload,
      savedDraft: product.draft,
    });
    setFormat(start?.format ?? "toml");
    setBody(start?.body ?? "");
    setNote("");
    setBodyTouched(false);
    setSubmitError(null);
    setBusyAction(null);
    setIsConfirmingRemove(false);
  }, [isLoading, isOpen, product]);

  useEffect(() => {
    if (isConfirmingRemove) {
      keepPayloadButtonRef.current?.focus();
    } else if (wasConfirmingRemoveRef.current) {
      removePayloadButtonRef.current?.focus();
    }
    wasConfirmingRemoveRef.current = isConfirmingRemove;
  }, [isConfirmingRemove]);

  const validation = useMemo(
    () => validateClientPayload(format, body),
    [body, format],
  );
  if (!product) return null;
  const selected = product;

  const platformLabel = selected.platform === "IOS" ? "iOS" : "Android";
  const { published, savedDraft } = snapshot;
  const baseline = savedDraft ?? published;
  const hasUnsavedEdits =
    format !== (baseline?.format ?? "toml") || body !== (baseline?.body ?? "");
  const differsFromPublished =
    !published || published.format !== format || published.body !== body;
  const isBusy = busyAction !== null;
  const isInputDisabled = isBusy || isLoading;
  const changedElsewhere =
    !isLoading &&
    (selected.expectedVersion !== snapshot.expectedVersion ||
      selected.expectedDraftRevision !== snapshot.draftRevision);
  const validationErrorId = `${payloadFieldId}-validation`;
  const payloadHelpId = `${payloadFieldId}-help`;
  const payloadCountId = `${payloadFieldId}-count`;
  const showValidationError = bodyTouched && !validation.valid;
  const target: Target = {
    productId: selected.productId,
    platform: selected.platform,
  };

  function requestClose(): void {
    if (!isBusy) onClose();
  }

  async function run(
    action: BusyAction,
    fallback: string,
    work: () => Promise<void>,
  ): Promise<void> {
    setSubmitError(null);
    setBusyAction(action);
    try {
      await work();
    } catch (error) {
      setSubmitError(getErrorMessage(error, fallback));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraft(): Promise<number> {
    const saved = await onSaveDraft({
      ...target,
      format,
      body,
      expectedDraftRevision: snapshot.draftRevision,
    });
    setSnapshot((current) => ({
      ...current,
      draftRevision: saved.revision,
      savedDraft: {
        format,
        body,
        baseVersion: saved.baseVersion,
        updatedAt: Date.now(),
      },
    }));
    return saved.revision;
  }

  function handleSaveDraft(): Promise<void> {
    setBodyTouched(true);
    return run("save", "Could not save the draft.", async () => {
      await saveDraft();
    });
  }

  function handlePublish(): Promise<void> {
    setBodyTouched(true);
    return run("publish", "Could not publish the payload.", async () => {
      const draftRevision = hasUnsavedEdits
        ? await saveDraft()
        : snapshot.draftRevision;
      await onPublish({
        ...target,
        expectedVersion: snapshot.expectedVersion,
        expectedDraftRevision: draftRevision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onClose();
    });
  }

  function handleDiscardDraft(): Promise<void> {
    return run("discard", "Could not discard the draft.", async () => {
      await onDiscardDraft({
        ...target,
        expectedDraftRevision: snapshot.draftRevision,
      });
      onClose();
    });
  }

  function handleRemove(): Promise<void> {
    return run("remove", "Could not remove client payload.", async () => {
      await onRemove({ ...target, expectedVersion: snapshot.expectedVersion });
      onClose();
    });
  }

  function handleRollback(toVersion: number): Promise<void> {
    return run("rollback", "Could not roll back the payload.", async () => {
      await onRollback({
        ...target,
        toVersion,
        expectedVersion: snapshot.expectedVersion,
      });
      onClose();
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      ariaLabel={`Edit client payload for ${selected.productId} on ${platformLabel}`}
      showCloseButton={false}
      className="max-w-4xl bg-card"
      contentClassName="p-5"
    >
      <div className="space-y-5" aria-busy={isBusy || isLoading}>
        <div className="pr-8">
          <h2 className="text-lg font-semibold">Client payload</h2>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            <span className="break-all font-mono text-foreground">
              {selected.productId}
            </span>{" "}
            · {platformLabel} · {selected.title}
          </p>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This payload is public app data. Anyone who can call your
              project&apos;s client endpoints may receive it. Never put API
              secrets, signing keys, credentials, or private server rules here.
              Show prices and trial terms from the store, not from this payload.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <label className="text-xs" htmlFor="client-payload-format">
            <span className="mb-1 block text-muted-foreground">Format</span>
            <select
              id="client-payload-format"
              value={format}
              disabled={isInputDisabled}
              onChange={(event) => {
                setFormat(event.target.value as ClientPayloadFormat);
                setBodyTouched(true);
                setSubmitError(null);
              }}
              className="w-full rounded border border-border bg-background px-2 py-1.5"
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Edits go to a draft that apps never receive. Publish makes it the
            next version; Store Sync and Reset never touch it.
          </div>
        </div>

        {isLoading ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading the current payload…
          </div>
        ) : null}

        <div>
          <label
            className="mb-1 block text-xs text-muted-foreground"
            htmlFor="client-payload-body"
          >
            Payload body
          </label>
          <textarea
            id="client-payload-body"
            value={body}
            disabled={isInputDisabled}
            required
            rows={12}
            spellCheck={false}
            aria-invalid={showValidationError ? "true" : undefined}
            aria-describedby={`${payloadHelpId} ${payloadCountId}${
              showValidationError ? ` ${validationErrorId}` : ""
            }`}
            onBlur={() => setBodyTouched(true)}
            onChange={(event) => {
              setBody(event.target.value);
              setBodyTouched(true);
              setSubmitError(null);
            }}
            placeholder={
              format === "toml"
                ? "[access]\nmax_items = 10"
                : format === "json"
                  ? '{\n  "maxItems": 10\n}'
                  : "premium-rule-v1"
            }
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2 text-[11px]">
            <p id={payloadHelpId} className="text-muted-foreground">
              Required. JSON must be an object. TOML and JSON syntax are
              validated before saving.
            </p>
            <p
              id={payloadCountId}
              aria-live="polite"
              className={
                validation.byteLength > MAX_CLIENT_PAYLOAD_BODY_BYTES
                  ? "font-medium text-rose-600 dark:text-rose-300"
                  : "text-muted-foreground"
              }
            >
              {formatClientPayloadBytes(validation.byteLength)} /{" "}
              {formatClientPayloadBytes(MAX_CLIENT_PAYLOAD_BODY_BYTES)}
            </p>
          </div>
          {showValidationError ? (
            <p
              id={validationErrorId}
              role="alert"
              className="mt-2 text-xs text-rose-600 dark:text-rose-300"
            >
              {validation.error}
            </p>
          ) : null}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {published
            ? `Published v${published.version} · ${new Date(published.updatedAt).toLocaleString()}`
            : "Nothing is published yet."}
          {savedDraft
            ? ` · Draft saved, based on v${savedDraft.baseVersion}${
                published && published.version !== savedDraft.baseVersion
                  ? ` (published changed since)`
                  : ""
              }`
            : ""}
          {hasUnsavedEdits ? " · Unsaved edits" : ""}
        </p>

        {changedElsewhere ? (
          <p
            role="status"
            className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200"
          >
            This payload changed in another session. Close and reopen to load
            the latest version before publishing.
          </p>
        ) : null}

        <div>
          <div
            role="tablist"
            aria-label="Payload details"
            className="mb-3 flex gap-1 border-b border-border text-xs"
          >
            {(["preview", "history"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => onTabChange(value)}
                className={`-mb-px border-b-2 px-3 py-1.5 ${
                  tab === value
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "preview" ? "Preview" : "History"}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "preview" ? (
              <ClientPayloadPreview
                draft={{ format, body }}
                draftValidation={validation}
                nextVersion={snapshot.expectedVersion + 1}
                platform={selected.platform}
                productId={selected.productId}
                published={published}
                sdkPreview={sdkPreview}
              />
            ) : (
              <ClientPayloadHistory
                currentVersion={selected.clientPayload?.version}
                history={history}
                isBusy={isBusy}
                onRollback={handleRollback}
                onSelect={onSelectVersion}
                selected={selectedVersionDetail}
                selectedVersion={selectedVersion}
              />
            )}
          </div>
        </div>

        {submitError ? (
          <p
            role="alert"
            className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200"
          >
            {submitError}
          </p>
        ) : null}

        {isConfirmingRemove ? (
          <div
            role="alert"
            className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs"
          >
            <p className="text-rose-700 dark:text-rose-200">
              Remove this payload? Apps will stop receiving it immediately.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                ref={keepPayloadButtonRef}
                type="button"
                disabled={isBusy}
                onClick={() => setIsConfirmingRemove(false)}
                className="rounded border border-border px-3 py-1.5 hover:bg-muted/50 disabled:opacity-60"
              >
                Keep payload
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleRemove()}
                className="inline-flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-rose-700 hover:bg-rose-500/30 disabled:opacity-60 dark:text-rose-200"
              >
                {busyAction === "remove" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Confirm remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs" htmlFor="client-payload-note">
              <span className="mb-1 block text-muted-foreground">
                Publish note (optional)
              </span>
              <input
                id="client-payload-note"
                value={note}
                maxLength={500}
                disabled={isInputDisabled}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1">
                {published ? (
                  <button
                    ref={removePayloadButtonRef}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setIsConfirmingRemove(true)}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove payload
                  </button>
                ) : null}
                {savedDraft ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDiscardDraft()}
                    className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-60"
                  >
                    Discard draft
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={requestClose}
                  className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted/50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    isInputDisabled || !validation.valid || !hasUnsavedEdits
                  }
                  onClick={() => void handleSaveDraft()}
                  className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "save" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={
                    isInputDisabled ||
                    !validation.valid ||
                    !differsFromPublished
                  }
                  onClick={() => void handlePublish()}
                  className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "publish" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Publish
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The single app-root instance required by the dashboard modal convention. */
export function ProductClientPayloadDialogRoot() {
  const [editorState, setEditorState] = useState(
    productClientPayloadEditorSignal.value,
  );
  useEffect(
    () =>
      productClientPayloadEditorSignal.subscribe((value) => {
        setEditorState(value);
      }),
    [],
  );

  const target = editorState.target;
  const targetKey = target
    ? `${editorState.instanceId}\u0000${target.projectId}\u0000${target.platform}\u0000${target.productId}`
    : "closed";
  // Tab and selected version reset whenever another product opens.
  const [view, setView] = useState<{
    targetKey: string;
    tab: ClientPayloadTab;
    selectedVersion?: number;
  }>({ targetKey, tab: "preview" });
  const currentView =
    view.targetKey === targetKey
      ? view
      : { targetKey, tab: "preview" as const, selectedVersion: undefined };

  const queryArgs =
    editorState.isOpen && target
      ? {
          projectId: target.projectId,
          platform: target.platform,
          productId: target.productId,
        }
      : null;
  const workspace = useQuery(
    api.products.query.getProductClientPayloadWorkspace,
    queryArgs ?? "skip",
  );
  const sdkPreview = useQuery(
    api.products.query.getProductClientPayloadSdkPreview,
    queryArgs && currentView.tab === "preview" ? queryArgs : "skip",
  );
  const history = useQuery(
    api.products.query.listProductClientPayloadHistory,
    queryArgs && currentView.tab === "history" ? queryArgs : "skip",
  );
  const selectedVersionDetail = useQuery(
    api.products.query.getProductClientPayloadHistoryVersion,
    queryArgs && currentView.selectedVersion !== undefined
      ? { ...queryArgs, version: currentView.selectedVersion }
      : "skip",
  );
  const saveDraft = useMutation(
    api.products.mutation.saveProductClientPayloadDraft,
  );
  const publishDraft = useMutation(
    api.products.mutation.publishProductClientPayloadDraft,
  );
  const discardDraft = useMutation(
    api.products.mutation.discardProductClientPayloadDraft,
  );
  const remove = useMutation(api.products.mutation.removeProductClientPayload);
  const rollback = useMutation(
    api.products.mutation.rollbackProductClientPayload,
  );

  const product = useMemo<ClientPayloadProduct | null>(
    () =>
      target && workspace !== null
        ? {
            projectId: target.projectId,
            platform: target.platform,
            productId: target.productId,
            title: target.title,
            expectedVersion: workspace?.expectedVersion ?? 0,
            expectedDraftRevision: workspace?.expectedDraftRevision ?? 0,
            ...(workspace?.clientPayload
              ? { clientPayload: workspace.clientPayload }
              : {}),
            ...(workspace?.draft ? { draft: workspace.draft } : {}),
          }
        : null,
    [workspace, target],
  );

  const projectId = target?.projectId;
  const withProject = <T extends object>(input: T) => {
    if (!projectId) throw new Error("No client payload target is open");
    return { projectId, ...input };
  };

  return (
    <ProductClientPayloadDialog
      key={targetKey}
      isOpen={editorState.isOpen}
      isLoading={
        editorState.isOpen && target !== null && workspace === undefined
      }
      product={product}
      onClose={closeProductClientPayloadEditor}
      tab={currentView.tab}
      onTabChange={(tab) => setView({ ...currentView, tab })}
      sdkPreview={sdkPreview}
      history={history}
      selectedVersion={currentView.selectedVersion}
      selectedVersionDetail={selectedVersionDetail}
      onSelectVersion={(selectedVersion) =>
        setView({ ...currentView, selectedVersion })
      }
      onSaveDraft={async (input) => {
        const saved = await saveDraft(withProject(input));
        toast.success(`Draft saved for ${input.productId}`);
        return saved;
      }}
      onPublish={async (input) => {
        const result = await publishDraft(withProject(input));
        toast.success(
          `Published v${result.version} of ${input.productId}'s payload`,
        );
      }}
      onDiscardDraft={async (input) => {
        await discardDraft(withProject(input));
        toast.success(`Draft discarded for ${input.productId}`);
      }}
      onRemove={async (input) => {
        await remove(withProject(input));
        toast.success(`Client payload removed from ${input.productId}`);
      }}
      onRollback={async (input) => {
        const result = await rollback(withProject(input));
        toast.success(
          `Rolled ${input.productId} back to v${input.toVersion} as v${result.version}`,
        );
      }}
    />
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
  }
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  return message || fallback;
}
