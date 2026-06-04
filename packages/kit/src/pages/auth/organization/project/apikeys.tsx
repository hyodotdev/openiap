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
import { ButtonPrimary } from "@/components/ButtonPrimary";
import {
  GeneratedApiKey,
  GeneratedApiKeyNotice,
} from "@/components/GeneratedApiKeyNotice";
import { PageLoading } from "@/components/LoadingSpinner";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

export default function ApiKeys() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyDescription, setKeyDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !project) return;

    setIsCreating(true);
    try {
      const result = await createApiKey({
        projectId: project._id,
        name: keyName.trim(),
        description: keyDescription.trim() || undefined,
      });
      trackEvent(MixpanelEvent.ApiKeyCreated);

      setRevealedApiKey({ name: result.name, key: result.key });
      toast.success("API key created. Copy it below before leaving this page.");

      // Reset form
      setKeyName("");
      setKeyDescription("");
      setShowCreateForm(false);
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: Id<"apiKeys">, keyName: string) => {
    if (
      !confirm(
        `Are you sure you want to revoke '${keyName}'? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await revokeApiKey({ keyId });
      toast.success("API key revoked successfully");
    } catch {
      toast.error("Failed to revoke API key");
    }
  };

  const handleRegenerateKey = async (keyId: Id<"apiKeys">, keyName: string) => {
    if (
      !confirm(
        `Are you sure you want to regenerate '${keyName}'? The old key will stop working immediately.`,
      )
    ) {
      return;
    }

    try {
      const result = await regenerateApiKey({ keyId });
      setRevealedApiKey({ name: result.name, key: result.key });
      toast.success(
        "API key regenerated. Copy it below before leaving this page.",
      );
    } catch {
      toast.error("Failed to regenerate API key");
    }
  };

  if (!project) {
    return <PageLoading />;
  }

  // Show loading while API keys are being fetched
  if (apiKeys === undefined) {
    return <PageLoading />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">{"API Keys"}</h2>
          <p className="text-muted-foreground mt-1">
            {"Manage API keys for authenticating with IAPKit API"}
          </p>
        </div>
        <ButtonPrimary onClick={() => setShowCreateForm(true)} size="md">
          {"Create API Key"}
          <Plus className="w-5 h-5" />
        </ButtonPrimary>
      </div>

      {revealedApiKey && (
        <GeneratedApiKeyNotice
          apiKey={revealedApiKey}
          onDismiss={() => setRevealedApiKey(null)}
        />
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card rounded-lg border-thin p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{"Create New API Key"}</h3>
          <form
            onSubmit={(e) => void handleCreateApiKey(e)}
            className="space-y-4"
          >
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

            <div className="flex gap-3 pt-2">
              <ButtonPrimary
                type="submit"
                disabled={isCreating || !keyName.trim()}
                loading={isCreating}
                size="md"
              >
                {isCreating ? "Creating..." : "Create API Key"}
              </ButtonPrimary>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setKeyName("");
                  setKeyDescription("");
                }}
                className="px-6 py-3 border border-border hover:bg-muted rounded-xl font-medium transition-all"
              >
                {"Cancel"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys && apiKeys.length > 0 ? (
        <div className="bg-card rounded-lg border-thin overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Name"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Description"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Key"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Status"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Created"}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    {"Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((apiKey) => {
                  const displayName =
                    apiKey.name === "Default Production Key"
                      ? "Default Production Key"
                      : apiKey.name;
                  const displayDescription =
                    apiKey.description ===
                    "Automatically generated production key"
                      ? "Automatically generated production key"
                      : apiKey.description;
                  return (
                    <tr
                      key={apiKey._id}
                      className="border-t border-border/80 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-6 py-4 align-top">
                        <span className="font-semibold text-foreground">
                          {displayName}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {displayDescription ? (
                          <p className="text-sm text-muted-foreground">
                            {displayDescription}
                          </p>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono text-muted-foreground break-all">
                            {apiKey.keyPreview}
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {apiKey.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            {"Active"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                            <XCircle className="w-3 h-3" />
                            {"Revoked"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(apiKey.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        {apiKey.isActive ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                void handleRegenerateKey(
                                  apiKey._id,
                                  apiKey.name,
                                )
                              }
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              title={"Regenerate"}
                              aria-label={"Regenerate"}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                void handleRevokeKey(apiKey._id, apiKey.name)
                              }
                              className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
                              title={"Revoke"}
                              aria-label={"Revoke"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-lg border-thin">
          <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{"No API keys yet"}</h3>
          <p className="text-muted-foreground mb-6">
            {"Create your first API key to start using the IAPKit API"}
          </p>
          <ButtonPrimary onClick={() => setShowCreateForm(true)} size="md">
            {"Create API Key"}
            <Plus className="w-5 h-5" />
          </ButtonPrimary>
        </div>
      )}
    </div>
  );
}
