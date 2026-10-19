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

interface ApiKeyRow {
  id: Id<"apiKeys">;
  name: string;
  description?: string | null;
  keyPreview: string;
  keyType: "publishable" | "secret";
  isActive: boolean;
  createdAt: number;
}

interface ApiKeyCreateInput {
  name: string;
  description?: string;
  keyType: "publishable" | "secret";
}

// Selection styling comes from state: Chromium can leave :has(:checked) stale
// on the radio that was just unchecked.
const KEY_TYPE_OPTIONS = [
  {
    value: "publishable",
    title: "Publishable",
    description:
      "For mobile apps: purchase verification and public product payload reads.",
  },
  {
    value: "secret",
    title: "Secret admin",
    description:
      "For trusted servers, CI, and MCP. Never ship this key in an app.",
  },
] as const;

interface ApiKeyListProps {
  apiKeys: ApiKeyRow[];
  onRegenerate: (key: ApiKeyRow) => void;
  onRevoke: (key: ApiKeyRow) => void;
}

function KeyTypeBadge({
  keyType,
}: {
  keyType: ApiKeyRow["keyType"];
}): React.JSX.Element {
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

function KeyStatusBadge({
  isActive,
}: {
  isActive: boolean;
}): React.JSX.Element {
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
function KeyPreviewCode({ preview }: { preview: string }): React.JSX.Element {
  return (
    <code
      title={preview}
      className="inline-block max-w-full truncate rounded bg-muted px-2 py-1 align-middle font-mono text-xs text-muted-foreground"
    >
      {preview}
    </code>
  );
}

function KeyCreatedDate({
  createdAt,
}: {
  createdAt: number;
}): React.JSX.Element {
  const date = new Date(createdAt);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
      <time dateTime={date.toISOString()}>{date.toLocaleDateString()}</time>
    </span>
  );
}

const HEADER_CELL =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide";

// Fixed columns keep every action on screen; names and descriptions wrap.
function ApiKeyTable({
  apiKeys,
  onRegenerate,
  onRevoke,
}: ApiKeyListProps): React.JSX.Element {
  return (
    <table className="hidden w-full table-fixed text-sm xl:table">
      <caption className="sr-only">{"API keys for this project"}</caption>
      <thead className="bg-muted/40 text-muted-foreground">
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {"Name"}
          </th>
          <th scope="col" className={`w-48 ${HEADER_CELL}`}>
            {"Key"}
          </th>
          <th scope="col" className={`w-32 ${HEADER_CELL}`}>
            {"Type"}
          </th>
          <th scope="col" className={`w-32 ${HEADER_CELL}`}>
            {"Status"}
          </th>
          <th scope="col" className={`w-32 ${HEADER_CELL}`}>
            {"Created"}
          </th>
          <th scope="col" className={`w-28 ${HEADER_CELL} text-right`}>
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
            <td className="px-4 py-3 align-middle">
              <p className="font-semibold text-foreground wrap-anywhere">
                {apiKey.name}
              </p>
              {apiKey.description ? (
                <p className="mt-1 leading-relaxed text-muted-foreground wrap-anywhere">
                  {apiKey.description}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3 align-middle">
              <KeyPreviewCode preview={apiKey.keyPreview} />
            </td>
            <td className="px-4 py-3 align-middle">
              <KeyTypeBadge keyType={apiKey.keyType} />
            </td>
            <td className="px-4 py-3 align-middle">
              <KeyStatusBadge isActive={apiKey.isActive} />
            </td>
            <td className="px-4 py-3 align-middle">
              <KeyCreatedDate createdAt={apiKey.createdAt} />
            </td>
            <td className="px-4 py-3 text-right align-middle">
              {apiKey.isActive ? (
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
              ) : (
                <span className="text-muted-foreground">
                  <span aria-hidden="true">{"—"}</span>
                  <span className="sr-only">{"No actions available"}</span>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Below xl the columns do not fit beside the sidebar, so each key is a row.
function ApiKeyList({
  apiKeys,
  onRegenerate,
  onRevoke,
}: ApiKeyListProps): React.JSX.Element {
  return (
    <ul className="divide-y divide-border xl:hidden">
      {apiKeys.map((apiKey) => (
        <li key={apiKey.id} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 font-semibold text-foreground wrap-anywhere">
              {apiKey.name}
            </h3>
            <span className="shrink-0">
              <KeyStatusBadge isActive={apiKey.isActive} />
            </span>
          </div>
          {apiKey.description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground wrap-anywhere">
              {apiKey.description}
            </p>
          ) : null}
          <dl className="mt-3 grid gap-2 text-sm sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-3">
            <div className="flex min-w-0 items-center justify-between gap-3 sm:block">
              <dt className="text-muted-foreground sm:mb-1 sm:text-xs">
                {"Key"}
              </dt>
              <dd className="min-w-0">
                <KeyPreviewCode preview={apiKey.keyPreview} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-muted-foreground sm:mb-1 sm:text-xs">
                {"Type"}
              </dt>
              <dd>
                <KeyTypeBadge keyType={apiKey.keyType} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block">
              <dt className="text-muted-foreground sm:mb-1 sm:text-xs">
                {"Created"}
              </dt>
              <dd>
                <KeyCreatedDate createdAt={apiKey.createdAt} />
              </dd>
            </div>
          </dl>
          {apiKey.isActive ? (
            <div className="mt-4 flex gap-2 sm:justify-end">
              <ButtonSecondary
                type="button"
                size="sm"
                onClick={() => onRegenerate(apiKey)}
                aria-label={`Regenerate ${apiKey.name}`}
                className="flex-1 gap-2 sm:flex-none"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                {"Regenerate"}
              </ButtonSecondary>
              <ButtonSecondary
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => onRevoke(apiKey)}
                aria-label={`Revoke ${apiKey.name}`}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {"Revoke"}
              </ButtonSecondary>
            </div>
          ) : (
            <p className="sr-only">{"No actions available"}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ApiKeysContent({
  apiKeys,
  onCreate,
  onRegenerate,
  onRevoke,
}: ApiKeyListProps & {
  onCreate: (input: ApiKeyCreateInput) => Promise<void>;
}): React.JSX.Element {
  const [showCreateForm, setShowCreateForm] = useState(false);
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
        <div className="mb-6 rounded-lg border-thin bg-card p-4 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">{"Create New API Key"}</h3>
          <form
            onSubmit={(e) => void handleCreateApiKey(e)}
            className="space-y-4"
          >
            <fieldset>
              <legend className="mb-2 block text-sm font-medium">
                {"Key Type"}
              </legend>
              <div className="grid gap-3 md:grid-cols-2">
                {KEY_TYPE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background ${
                      keyType === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="keyType"
                      value={option.value}
                      checked={keyType === option.value}
                      onChange={() => setKeyType(option.value)}
                      className="mt-1 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">{option.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="keyName"
                className="mb-2 block text-sm font-medium"
              >
                {"Key Name"} <span aria-hidden="true">{"*"}</span>
              </label>
              <input
                id="keyName"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="input"
                placeholder={"e.g., Production Server Key"}
                required
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium"
              >
                {"Description"}
              </label>
              <textarea
                id="description"
                value={keyDescription}
                onChange={(e) => setKeyDescription(e.target.value)}
                className="input h-auto"
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
              <ButtonPrimary
                type="button"
                variant="outline"
                size="md"
                onClick={resetCreateForm}
                className="w-full sm:w-auto"
              >
                {"Cancel"}
              </ButtonPrimary>
            </div>
          </form>
        </div>
      )}

      {apiKeys.length > 0 ? (
        <div className="overflow-hidden rounded-lg border-thin bg-card">
          <ApiKeyTable
            apiKeys={apiKeys}
            onRegenerate={onRegenerate}
            onRevoke={onRevoke}
          />
          <ApiKeyList
            apiKeys={apiKeys}
            onRegenerate={onRegenerate}
            onRevoke={onRevoke}
          />
        </div>
      ) : (
        <div className="rounded-lg border-thin bg-card px-4 py-16 text-center">
          <Key
            className="mx-auto mb-4 h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
          <h3 className="mb-2 text-lg font-semibold">{"No API keys yet"}</h3>
          <p className="mb-6 text-muted-foreground">
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

export default function ApiKeys(): React.JSX.Element {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();

  const [revealedApiKey, setRevealedApiKey] = useState<GeneratedApiKey | null>(
    null,
  );

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
  const apiKeys = useQuery(
    api.apiKeys.query.listProjectApiKeys,
    project ? { projectId: project._id } : "skip",
  );

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

  const handleRevokeKey = (key: ApiKeyRow) => {
    if (
      !confirm(
        `Are you sure you want to revoke '${key.name}'? This action cannot be undone.`,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        await revokeApiKey({ keyId: key.id });
        toast.success("API key revoked successfully");
      } catch {
        toast.error("Failed to revoke API key");
      }
    })();
  };

  const handleRegenerateKey = (key: ApiKeyRow) => {
    if (
      !confirm(
        `Are you sure you want to regenerate '${key.name}'? The old key will stop working immediately.`,
      )
    ) {
      return;
    }

    void (async () => {
      try {
        const result = await regenerateApiKey({ keyId: key.id });
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

  if (!project || apiKeys === undefined) {
    return <PageLoading />;
  }

  const rows = apiKeys.map(
    (apiKey): ApiKeyRow => ({
      id: apiKey._id,
      name: apiKey.name,
      description: apiKey.description,
      keyPreview: apiKey.keyPreview,
      keyType: apiKey.keyType ?? "publishable",
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    }),
  );

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
        onRegenerate={handleRegenerateKey}
        onRevoke={handleRevokeKey}
      />
    </div>
  );
}
