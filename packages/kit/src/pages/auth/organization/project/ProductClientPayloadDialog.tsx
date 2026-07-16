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
import {
  MAX_CLIENT_PAYLOAD_BODY_BYTES,
  formatClientPayloadBytes,
  validateClientPayload,
  type ClientPayloadFormat,
  type ProductClientPayload,
} from "./clientPayload";

export type ClientPayloadProduct = {
  clientPayload?: ProductClientPayload;
  expectedVersion: number;
  projectId?: Id<"projects">;
  platform: "IOS" | "Android";
  productId: string;
  title: string;
};

export interface SaveClientPayloadInput {
  body: string;
  expectedVersion: number;
  format: ClientPayloadFormat;
  platform: "IOS" | "Android";
  productId: string;
}

export interface RemoveClientPayloadInput {
  expectedVersion: number;
  platform: "IOS" | "Android";
  productId: string;
}

interface ProductClientPayloadDialogProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onRemove: (input: RemoveClientPayloadInput) => Promise<void>;
  onSave: (input: SaveClientPayloadInput) => Promise<void>;
  product: ClientPayloadProduct | null;
}

const FORMAT_OPTIONS: Array<{
  label: string;
  value: ClientPayloadFormat;
}> = [
  { value: "toml", label: "TOML" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Plain text" },
];

export function ProductClientPayloadDialog({
  isOpen,
  isLoading = false,
  onClose,
  onRemove,
  onSave,
  product,
}: ProductClientPayloadDialogProps) {
  const [format, setFormat] = useState<ClientPayloadFormat>("toml");
  const [body, setBody] = useState("");
  const [initialPayload, setInitialPayload] = useState<ProductClientPayload>();
  const [initialExpectedVersion, setInitialExpectedVersion] = useState(0);
  const [bodyTouched, setBodyTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const activeTargetRef = useRef<string | null>(null);
  const initializedTargetRef = useRef<string | null>(null);
  const keepPayloadButtonRef = useRef<HTMLButtonElement>(null);
  const removePayloadButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingRemoveRef = useRef(false);
  const payloadFieldId = useId();

  useEffect(() => {
    if (!isOpen || !product) {
      if (!isOpen) {
        activeTargetRef.current = null;
        initializedTargetRef.current = null;
      }
      return;
    }
    const targetKey = `${product.projectId ?? "unknown-project"}\u0000${product.platform}\u0000${product.productId}`;
    if (activeTargetRef.current !== targetKey) {
      activeTargetRef.current = targetKey;
      initializedTargetRef.current = null;
      setInitialPayload(undefined);
      setInitialExpectedVersion(0);
      setFormat("toml");
      setBody("");
      setBodyTouched(false);
      setSubmitError(null);
      setIsSaving(false);
      setIsConfirmingRemove(false);
    }
    if (isLoading || initializedTargetRef.current === targetKey) return;

    // Snapshot exactly once per opened target. A reactive query update from
    // another tab must not overwrite the operator's draft or silently advance
    // expectedVersion; the mutation should surface an optimistic conflict.
    initializedTargetRef.current = targetKey;
    setInitialPayload(product.clientPayload);
    setInitialExpectedVersion(product.expectedVersion);
    setFormat(product.clientPayload?.format ?? "toml");
    setBody(product.clientPayload?.body ?? "");
    setBodyTouched(false);
    setSubmitError(null);
    setIsSaving(false);
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
  const selectedProduct = product;

  const platformLabel = selectedProduct.platform === "IOS" ? "iOS" : "Android";
  const originalFormat = initialPayload?.format ?? "toml";
  const originalBody = initialPayload?.body ?? "";
  const hasChanges = format !== originalFormat || body !== originalBody;
  const isBusy = isSaving;
  const isInputDisabled = isSaving || isLoading;
  const validationErrorId = `${payloadFieldId}-validation`;
  const payloadHelpId = `${payloadFieldId}-help`;
  const payloadCountId = `${payloadFieldId}-count`;
  const showValidationError = bodyTouched && !validation.valid;

  function requestClose(): void {
    if (!isBusy) onClose();
  }

  async function handleSave(): Promise<void> {
    setBodyTouched(true);
    setSubmitError(null);
    if (!validation.valid || !hasChanges || isInputDisabled) return;

    setIsSaving(true);
    try {
      await onSave({
        productId: selectedProduct.productId,
        platform: selectedProduct.platform,
        format,
        body,
        expectedVersion: initialExpectedVersion,
      });
      onClose();
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Could not save client payload."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(): Promise<void> {
    if (!initialPayload || isBusy) return;

    setSubmitError(null);
    setIsSaving(true);
    try {
      await onRemove({
        productId: selectedProduct.productId,
        platform: selectedProduct.platform,
        expectedVersion: initialExpectedVersion,
      });
      onClose();
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, "Could not remove client payload."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      ariaLabel={`Edit client payload for ${selectedProduct.productId} on ${platformLabel}`}
      showCloseButton={false}
      className="max-w-2xl bg-card"
      contentClassName="p-5"
    >
      <div className="space-y-5" aria-busy={isInputDisabled}>
        <div className="pr-8">
          <h2 className="text-lg font-semibold">Client payload</h2>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            <span className="break-all font-mono text-foreground">
              {selectedProduct.productId}
            </span>{" "}
            · {platformLabel} · {selectedProduct.title}
          </p>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This payload is public app data. Anyone who can call your
              project&apos;s client endpoints may receive it. Never put API
              secrets, signing keys, credentials, or private server rules here.
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
            IAPKit stores this separately from App Store Connect and Play
            Console metadata. Store Sync and Reset do not push, overwrite, or
            delete it.
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
            rows={14}
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

        {initialPayload ? (
          <p className="text-[11px] text-muted-foreground">
            Version {initialPayload.version} · last updated{" "}
            {new Date(initialPayload.updatedAt).toLocaleString()}
          </p>
        ) : null}

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
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Confirm remove
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {initialPayload ? (
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
            </div>
            <div className="flex gap-2">
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
                disabled={isInputDisabled || !validation.valid || !hasChanges}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save payload
              </button>
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
  const payloadState = useQuery(
    api.products.query.getProductClientPayloadEditorState,
    editorState.isOpen && target
      ? {
          projectId: target.projectId,
          platform: target.platform,
          productId: target.productId,
        }
      : "skip",
  );
  const upsert = useMutation(api.products.mutation.upsertProductClientPayload);
  const remove = useMutation(api.products.mutation.removeProductClientPayload);
  const product = useMemo<ClientPayloadProduct | null>(
    () =>
      target && payloadState !== null
        ? {
            projectId: target.projectId,
            platform: target.platform,
            productId: target.productId,
            title: target.title,
            expectedVersion: payloadState?.expectedVersion ?? 0,
            ...(payloadState?.clientPayload
              ? { clientPayload: payloadState.clientPayload }
              : {}),
          }
        : null,
    [payloadState, target],
  );

  const handleSave = async (input: SaveClientPayloadInput): Promise<void> => {
    if (!target) return;
    await upsert({
      projectId: target.projectId,
      productId: input.productId,
      platform: input.platform,
      format: input.format,
      body: input.body,
      expectedVersion: input.expectedVersion,
    });
    toast.success(`Client payload saved for ${input.productId}`);
  };

  const handleRemove = async (
    input: RemoveClientPayloadInput,
  ): Promise<void> => {
    if (!target) return;
    await remove({
      projectId: target.projectId,
      productId: input.productId,
      platform: input.platform,
      expectedVersion: input.expectedVersion,
    });
    toast.success(`Client payload removed from ${input.productId}`);
  };

  return (
    <ProductClientPayloadDialog
      key={
        target
          ? `${editorState.instanceId}\u0000${target.projectId}\u0000${target.platform}\u0000${target.productId}`
          : "closed"
      }
      isOpen={editorState.isOpen}
      isLoading={
        editorState.isOpen && target !== null && payloadState === undefined
      }
      product={product}
      onClose={closeProductClientPayloadEditor}
      onSave={handleSave}
      onRemove={handleRemove}
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
