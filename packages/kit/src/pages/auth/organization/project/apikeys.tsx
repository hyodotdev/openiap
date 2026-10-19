import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api, Id } from "@/convex";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Trash2,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { ButtonPrimary } from "@/components/ButtonPrimary";
import { ButtonSecondary } from "@/components/ButtonSecondary";
import {
  GeneratedApiKey,
  GeneratedApiKeyNotice,
} from "@/components/GeneratedApiKeyNotice";
import { PageLoading } from "@/components/LoadingSpinner";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

export interface ApiKeyRow {
  id: string;
  name: string;
  description?: string | null;
  keyPreview: string;
  keyType: "publishable" | "secret";
  isActive: boolean;
  createdAt: number;
}

export interface ApiKeyCreateInput {
  name: string;
  description?: string;
  keyType: "publishable" | "secret";
}

interface ApiKeysContentProps {
  apiKeys: ApiKeyRow[] | undefined;
  onCreate: (input: ApiKeyCreateInput) => Promise<void>;
  onRegenerate: (key: ApiKeyRow) => void;
  onRevoke: (key: ApiKeyRow) => void;
  initialShowCreateForm?: boolean;
}

interface ApiKeyActionProps {
  apiKey: ApiKeyRow;
  onRegenerate: (key: ApiKeyRow) => void;
  onRevoke: (key: ApiKeyRow) => void;
}

function KeyTypeBadge({ keyType }: { keyType: ApiKeyRow["keyType"] }) {
  return keyType === "publishable" ? (
    <Badge variant="default" size="sm">
      {"Publishable"}
    </Badge>
  ) : (
    <Badge variant="warning" size="sm">
      {"Secret admin"}
    </Badge>
  );
}

function KeyStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge
      variant="success"
      size="sm"
      icon={<CheckCircle className="h-full w-full" aria-hidden="true" />}
    >
      {"Active"}
    </Badge>
  ) : (
    <Badge
      variant="danger"
      size="sm"
      icon={<XCircle className="h-full w-full" aria-hidden="true" />}
    >
      {"Revoked"}
    </Badge>
  );
}

// Masked previews are already abbreviated server-side, so one line is enough.
function KeyPreviewCode({ preview }: { preview: string }) {
  return (
    <code className="inline-block max-w-full whitespace-nowrap rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
      {preview}
    </code>
  );
}

function KeyCreatedDate({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
      <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time>
    </span>
  );
}

function ApiKeyIconActions({
  apiKey,
  onRegenerate,
  onRevoke,
}: ApiKeyActionProps) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => onRegenerate(apiKey)}
        className="icon-button"
        title={`Regenerate ${apiKey.name}`}
        aria-label={`Regenerate ${apiKey.name}`}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onRevoke(apiKey)}
        className="icon-button icon-button-destructive"
        title={`Revoke ${apiKey.name}`}
        aria-label={`Revoke ${apiKey.name}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function ApiKeyNoActions() {
  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">{"—"}</span>
      <span className="sr-only">{"No actions available"}</span>
    </span>
  );
}

function ApiKeyTable({
  apiKeys,
  onRegenerate,
  onRevoke,
}: {
  apiKeys: ApiKeyRow[];
  onRegenerate: (key: ApiKeyRow) => void;
  onRevoke: (key: ApiKeyRow) => void;
}) {
  return (
    <div className="hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <caption className="sr-only">{"API keys for this project"}</caption>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th
                scope="col"
                className="w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Name"}
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Description"}
              </th>
              <th
                scope="col"
                className="w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Key"}
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Type"}
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Status"}
              </th>
              <th
                scope="col"
                className="w-28 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
              >
                {"Created"}
              </th>
              <th
                scope="col"
                className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide"
              >
                {"Actions"}
              </th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((apiKey) => (
              <tr
                key={apiKey.id}
                className="border-t border-border/80 transition-colors hover:bg-muted/10"
              >
                <td className="w-40 max-w-40 px-4 py-3 align-top">
                  <span className="font-semibold break-words text-foreground">
                    {apiKey.name}
                  </span>
                </td>
                <td className="px-4 py-3 align-top">
                  {apiKey.description ? (
                    <p className="max-w-[26rem] text-sm leading-relaxed break-words text-muted-foreground">
                      {apiKey.description}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">{"—"}</span>
                  )}
                </td>
                <td className="w-44 px-4 py-3 align-top">
                  <KeyPreviewCode preview={apiKey.keyPreview} />
                </td>
                <td className="w-28 px-4 py-3 align-top">
                  <KeyTypeBadge keyType={apiKey.keyType} />
                </td>
                <td className="w-28 px-4 py-3 align-top">
                  <KeyStatusBadge isActive={apiKey.isActive} />
                </td>
                <td className="w-28 px-4 py-3 align-top">
                  <KeyCreatedDate createdAt={apiKey.createdAt} />
                </td>
                <td className="w-24 px-4 py-3 text-right align-top">
                  {apiKey.isActive ? (
                    <ApiKeyIconActions
                      apiKey={apiKey}
                      onRegenerate={onRegenerate}
                      onRevoke={onRevoke}
                    />
                  ) : (
                    <ApiKeyNoActions />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Narrow screens get labeled cards instead of a cramped seven-column table.
function ApiKeyCards({
  apiKeys,
  onRegenerate,
  onRevoke,
}: {
  apiKeys: ApiKeyRow[];
  onRegenerate: (key: ApiKeyRow) => void;
  onRevoke: (key: ApiKeyRow) => void;
}) {
  return (
    <ul className="space-y-3 lg:hidden">
      {apiKeys.map((apiKey) => (
        <li key={apiKey.id} className="rounded-lg border-thin bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 font-semibold break-words text-foreground">
              {apiKey.name}
            </h3>
            <KeyStatusBadge isActive={apiKey.isActive} />
          </div>
          {apiKey.description ? (
            <p className="mt-2 text-sm leading-relaxed break-words text-muted-foreground">
              {apiKey.description}
            </p>
          ) : null}
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{"Key"}</dt>
              <dd className="min-w-0">
                <KeyPreviewCode preview={apiKey.keyPreview} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{"Type"}</dt>
              <dd>
                <KeyTypeBadge keyType={apiKey.keyType} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">{"Created"}</dt>
              <dd>
                <KeyCreatedDate createdAt={apiKey.createdAt} />
              </dd>
            </div>
          </dl>
          {apiKey.isActive ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <ButtonSecondary
                type="button"
                size="sm"
                onClick={() => onRegenerate(apiKey)}
                aria-label={`Regenerate ${apiKey.name}`}
                className="w-full gap-2 sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {"Regenerate"}
              </ButtonSecondary>
              <ButtonPrimary
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onRevoke(apiKey)}
                aria-label={`Revoke ${apiKey.name}`}
                className="w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {"Revoke"}
              </ButtonPrimary>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {"No actions available"}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ApiKeysContent({
  apiKeys,
  onCreate,
  onRegenerate,
  onRevoke,
  initialShowCreateForm = false,
}: ApiKeysContentProps) {
  const [showCreateForm, setShowCreateForm] = useState(initialShowCreateForm);
  const [keyName, setKeyName] = useState("");
  const [keyDescription, setKeyDescription] = useState("");
  const [keyType, setKeyType] = useState<"publishable" | "secret">(
    "publishable",
  );
  const [isCreating, setIsCreating] = useState(false);

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setKeyName("");
    setKeyDescription("");
    setKeyType("publishable");
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreate({
        name: keyName.trim(),
        description: keyDescription.trim() || undefined,
        keyType,
      });
      resetCreateForm();
    } catch {
      // The page reports the failure; keep the form open for retry.
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">{"API Keys"}</h2>
          <p className="mt-1 text-muted-foreground">
            {
              "Use publishable keys in apps. Keep secret keys on trusted backends and in CI or MCP."
            }
          </p>
        </div>
        <ButtonPrimary
          onClick={() => setShowCreateForm(true)}
          size="md"
          className="w-full shrink-0 sm:w-auto"
        >
          {"Create API Key"}
          <Plus className="h-5 w-5" aria-hidden="true" />
        </ButtonPrimary>
      </div>

      {showCreateForm && (
        <div className="bg-card rounded-lg border-thin p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{"Create New API Key"}</h3>
          <form
            onSubmit={(e) => void handleCreateApiKey(e)}
            className="space-y-4"
          >
            <fieldset>
              <legend className="mb-2 block text-sm font-medium">
                {"Key Type"}
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background">
                  <input
                    type="radio"
                    name="keyType"
                    value="publishable"
                    checked={keyType === "publishable"}
                    onChange={() => setKeyType("publishable")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">{"Publishable"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {
                        "For mobile apps: purchase verification and public product payload reads."
                      }
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background">
                  <input
                    type="radio"
                    name="keyType"
                    value="secret"
                    checked={keyType === "secret"}
                    onChange={() => setKeyType("secret")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">{"Secret admin"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {
                        "For trusted servers, CI, and MCP. Never ship this key in an app."
                      }
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="keyName"
                  className="block text-sm font-medium mb-2"
                >
                  {"Key Name"} *
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border-thin rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder={"e.g., Production Server Key"}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
              >
                {"Description"}
              </label>
              <textarea
                id="description"
                value={keyDescription}
                onChange={(e) => setKeyDescription(e.target.value)}
                className="w-full px-3 py-2 bg-background border-thin rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-colors"
                placeholder={"Optional description for this API key"}
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <ButtonPrimary
                type="submit"
                disabled={isCreating || !keyName.trim()}
                loading={isCreating}
                size="md"
                className="w-full sm:w-auto"
              >
                {isCreating ? "Creating..." : "Create API Key"}
              </ButtonPrimary>
              <ButtonSecondary
                type="button"
                onClick={resetCreateForm}
                className="rounded-xl px-6 py-3 text-base"
              >
                {"Cancel"}
              </ButtonSecondary>
            </div>
          </form>
        </div>
      )}

      {apiKeys === undefined ? (
        <PageLoading />
      ) : apiKeys.length > 0 ? (
        <div className="bg-card rounded-lg border-thin overflow-hidden">
          <ApiKeyTable
            apiKeys={apiKeys}
            onRegenerate={onRegenerate}
            onRevoke={onRevoke}
          />
          <div className="p-4 lg:hidden">
            <ApiKeyCards
              apiKeys={apiKeys}
              onRegenerate={onRegenerate}
              onRevoke={onRevoke}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-card rounded-lg border-thin">
          <Key
            className="w-12 h-12 text-muted-foreground mx-auto mb-4"
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold mb-2">{"No API keys yet"}</h3>
          <p className="text-muted-foreground mb-6">
            {"Create your first API key to start using the IAPKit API"}
          </p>
          <ButtonPrimary
            onClick={() => setShowCreateForm(true)}
            size="md"
            className="w-full sm:w-auto"
          >
            {"Create API Key"}
            <Plus className="h-5 w-5" aria-hidden="true" />
          </ButtonPrimary>
        </div>
      )}
    </div>
  );
}

export default function ApiKeys() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();

  const [revealedApiKey, setRevealedApiKey] = useState<GeneratedApiKey | null>(
    null,
  );

  // Get current project
  const currentOrg = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const project = useQuery(
    api.projects.query.getProjectByOrgAndSlug,
    currentOrg && projectSlug
      ? { organizationId: currentOrg._id, projectSlug: projectSlug }
      : "skip",
  );

  // Get API keys for this project
  const apiKeys = useQuery(
    api.apiKeys.query.listProjectApiKeys,
    project ? { projectId: project._id } : "skip",
  );

  // Mutations
  const createApiKey = useMutation(api.apiKeys.mutation.create);
  const revokeApiKey = useMutation(api.apiKeys.mutation.revoke);
  const regenerateApiKey = useMutation(api.apiKeys.mutation.regenerate);

  const handleCreate = async (input: ApiKeyCreateInput): Promise<void> => {
    if (!project) return;
    try {
      const result = await createApiKey({
        projectId: project._id,
        name: input.name,
        description: input.description,
        keyType: input.keyType,
      });
      trackEvent(MixpanelEvent.ApiKeyCreated);

      setRevealedApiKey({
        name: result.name,
        key: result.key,
        keyType: result.keyType,
      });
      toast.success("API key created. Copy it below before leaving this page.");
    } catch {
      toast.error("Failed to create API key");
      throw new Error("Failed to create API key");
    }
  };

  const handleRevokeKey = (keyId: Id<"apiKeys">, keyName: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke '${keyName}'? This action cannot be undone.`,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        await revokeApiKey({ keyId });
        toast.success("API key revoked successfully");
      } catch {
        toast.error("Failed to revoke API key");
      }
    })();
  };

  const handleRegenerateKey = (keyId: Id<"apiKeys">, keyName: string) => {
    if (
      !confirm(
        `Are you sure you want to regenerate '${keyName}'? The old key will stop working immediately.`,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        const result = await regenerateApiKey({ keyId });
        setRevealedApiKey({
          name: result.name,
          key: result.key,
          keyType: result.keyType,
        });
        toast.success(
          "API key regenerated. Copy it below before leaving this page.",
        );
      } catch {
        toast.error("Failed to regenerate API key");
      }
    })();
  };

  if (!project) {
    return <PageLoading />;
  }

  // Show loading while API keys are being fetched
  if (apiKeys === undefined) {
    return <PageLoading />;
  }

  const docById = new Map<string, (typeof apiKeys)[number]>(
    apiKeys.map((apiKey) => [apiKey._id, apiKey]),
  );
  const toRow = (apiKey: (typeof apiKeys)[number]): ApiKeyRow => ({
    id: apiKey._id,
    name: apiKey.name,
    description: apiKey.description,
    keyPreview: apiKey.keyPreview,
    keyType: apiKey.keyType ?? "publishable",
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
  });
  const rows = apiKeys.map(toRow);
  const withDoc = (row: ApiKeyRow) => docById.get(row.id);

  return (
    <div>
      {revealedApiKey && (
        <GeneratedApiKeyNotice
          apiKey={revealedApiKey}
          onDismiss={() => setRevealedApiKey(null)}
        />
      )}

      <ApiKeysContent
        apiKeys={rows}
        onCreate={handleCreate}
        onRegenerate={(row) => {
          const doc = withDoc(row);
          if (doc) handleRegenerateKey(doc._id, doc.name);
        }}
        onRevoke={(row) => {
          const doc = withDoc(row);
          if (doc) handleRevokeKey(doc._id, doc.name);
        }}
      />
    </div>
  );
}
