import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "react-router-dom";
import { api, Id } from "@/convex";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Smartphone,
  Code2,
  Layers,
  Loader2,
  Bot,
  MonitorSmartphone,
  Server,
  Braces,
  Box,
  Gamepad2,
  Globe,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import ProjectCard from "./ProjectCard";
import { ButtonPrimary } from "@/components/ButtonPrimary";
import {
  GeneratedApiKey,
  GeneratedApiKeyNotice,
} from "@/components/GeneratedApiKeyNotice";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

const PLATFORM_OPTIONS = [
  {
    value: "react-native",
    label: "React Native",
    description: "React Native / Expo",
    icon: Smartphone,
  },
  {
    value: "flutter",
    label: "Flutter",
    description: "Dart",
    icon: Layers,
  },
  {
    value: "kmp",
    label: "Kotlin Multiplatform",
    description: "KMP / Compose",
    icon: Code2,
  },
  {
    value: "android",
    label: "Android",
    description: "Kotlin / Java",
    icon: Bot,
  },
  {
    value: "ios",
    label: "iOS",
    description: "Swift / Objective-C",
    icon: MonitorSmartphone,
  },
  {
    value: "node",
    label: "Node.js",
    description: "Server-side",
    icon: Server,
  },
  {
    value: "php",
    label: "PHP",
    description: "Laravel, Symfony, etc.",
    icon: Braces,
  },
  {
    value: "dotnet",
    label: ".NET",
    description: "C# / F#",
    icon: Box,
  },
  {
    value: "unity",
    label: "Unity",
    description: "C# / Game",
    icon: Gamepad2,
  },
  {
    value: "web",
    label: "Web",
    description: "JavaScript / TypeScript",
    icon: Globe,
  },
  {
    value: "other",
    label: "Other",
    description: "Something else",
    icon: Sparkles,
  },
] as const;

type PlatformOption = (typeof PLATFORM_OPTIONS)[number]["value"];

export default function Projects() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const currentOrg = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const projectsQuery = useQuery(
    api.projects.query.listOrganizationProjects,
    currentOrg ? { organizationId: currentOrg._id } : "skip",
  );
  const projects = projectsQuery ?? [];
  const isLoadingProjects = currentOrg && projectsQuery === undefined;
  const createProject = useMutation(api.projects.mutation.createProject);
  const deleteProject = useMutation(api.projects.mutation.deleteProject);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformOption | "">(
    "",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState<GeneratedApiKey | null>(
    null,
  );

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !currentOrg) return;

    setIsCreating(true);
    try {
      const result = await createProject({
        organizationId: currentOrg._id,
        name: newProjectName.trim(),
        slug: newProjectSlug.trim() || undefined,
        platform: selectedPlatform || undefined,
      });
      trackEvent(MixpanelEvent.ProjectCreated, {
        platform: selectedPlatform || undefined,
      });
      setNewProjectName("");
      setNewProjectSlug("");
      setSlugManuallyEdited(false);
      setSelectedPlatform("");
      setShowCreateForm(false);
      setRevealedApiKey({
        name: "Default Production Key",
        key: result.apiKey,
      });
      toast.success("Project created. Copy the default production key below.");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (
    projectId: Id<"projects">,
    projectName: string,
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete "${projectName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteProject({ projectId });
      toast.success("Project deleted successfully");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewProjectName(name);
    // Auto-generate slug from name only if not manually edited
    if (!slugManuallyEdited) {
      setNewProjectSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setNewProjectSlug(slug);
    setSlugManuallyEdited(true); // Mark as manually edited
  };

  if (!currentOrg) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">{"No organization selected"}</p>
        </div>
      </div>
    );
  }

  const handlePlatformSelect = (value: PlatformOption) => {
    setSelectedPlatform((prev) => (prev === value ? "" : value));
  };

  return (
    <div className="container max-w-7xl mx-auto py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{"Projects"}</h1>
          <p className="text-muted-foreground mt-1">
            {"Manage your organization's projects"}
          </p>
        </div>
        <ButtonPrimary onClick={() => setShowCreateForm(true)} size="md">
          {"Create Project"}
          <Plus className="w-5 h-5" />
        </ButtonPrimary>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card rounded-lg border-thin p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{"Create New Project"}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateProject(e);
            }}
            className="space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium mb-2"
                >
                  {"Project Name"} *
                </label>
                <input
                  id="projectName"
                  type="text"
                  value={newProjectName}
                  onChange={handleNameChange}
                  className="w-full px-3 py-2 bg-background border-thin rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-colors"
                  placeholder={"My IAP App"}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="projectSlug"
                  className="block text-sm font-medium mb-2"
                >
                  {"Project URL"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {orgSlug}/
                  </span>
                  <input
                    id="projectSlug"
                    type="text"
                    value={newProjectSlug}
                    onChange={handleSlugChange}
                    className="flex-1 px-3 py-2 bg-background border-thin rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder={"my-ios-app"}
                  />
                </div>
              </div>
            </div>

            {/* Platform Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  {"Platform or Language (optional)"}
                </label>
                {selectedPlatform && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform("")}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {"Clear selection"}
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {
                  "Select the platform or runtime you target. Skip this if yours isn't listed."
                }
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PLATFORM_OPTIONS.map(
                  ({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handlePlatformSelect(value)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        selectedPlatform === value
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                          : "border-border bg-card hover:border-muted-foreground/50"
                      }`}
                    >
                      {selectedPlatform === value && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                          <CheckCircle2 className="w-4 h-4" />
                          {"Selected"}
                        </span>
                      )}
                      <div className="flex items-start gap-3 pr-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            selectedPlatform === value
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div
                            className={`text-sm font-semibold ${
                              selectedPlatform === value
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {label}
                          </div>
                          {description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <ButtonPrimary
                type="submit"
                disabled={isCreating || !newProjectName.trim()}
                loading={isCreating}
                size="md"
              >
                {isCreating ? "Creating..." : "Create Project"}
                {!isCreating && <Plus className="w-5 h-5" />}
              </ButtonPrimary>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewProjectName("");
                  setNewProjectSlug("");
                  setSlugManuallyEdited(false);
                  setSelectedPlatform("");
                }}
                className="px-6 py-3 border border-border hover:bg-muted rounded-xl font-medium transition-all"
              >
                {"Cancel"}
              </button>
            </div>
          </form>
        </div>
      )}

      {revealedApiKey && (
        <GeneratedApiKeyNotice
          apiKey={revealedApiKey}
          onDismiss={() => setRevealedApiKey(null)}
        />
      )}

      {/* Projects Grid */}
      {isLoadingProjects ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              orgSlug={currentOrg.slug}
              onDeleteProject={handleDeleteProject}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{"No projects yet"}</h3>
          <p className="text-muted-foreground mb-6">
            {"Create your first project to get started"}
          </p>
          <ButtonPrimary onClick={() => setShowCreateForm(true)} size="md">
            {"Create Project"}
            <Plus className="w-5 h-5" />
          </ButtonPrimary>
        </div>
      )}
    </div>
  );
}
