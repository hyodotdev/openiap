import { useMemo } from "react";
import { useParams, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useQuery } from "convex/react";
import { Badge, PlatformBadge } from "../../../../components/Badge";
import type { LucideIcon } from "lucide-react";
import {
  Settings,
  ChevronLeft,
  Package,
  Key,
  ShoppingBag,
  Activity,
  Layers,
  Webhook,
  BarChart3,
} from "lucide-react";
import { PageLoading } from "@/components/LoadingSpinner";

import { api } from "@/convex";

const TAB_IDS = [
  "dashboard",
  "purchases",
  "subscriptions",
  "analytics",
  "products",
  "webhooks",
  "apikeys",
  "settings",
] as const;
type TabId = (typeof TAB_IDS)[number];
type VisibleTabId = Exclude<TabId, "dashboard">;
const DEFAULT_TAB: VisibleTabId = "purchases";

interface Tab {
  id: VisibleTabId;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export default function ProjectIndex() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const currentOrg = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const project = useQuery(
    api.projects.query.getProject,
    currentOrg && projectSlug
      ? { organizationId: currentOrg._id, projectSlug }
      : "skip",
  );

  const tabs: Tab[] = [
    {
      id: "purchases",
      label: "Purchases",
      icon: ShoppingBag,
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      icon: Activity,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: BarChart3,
      badge: "Beta",
    },
    {
      id: "products",
      label: "Products",
      icon: Layers,
      badge: "Beta",
    },
    {
      id: "webhooks",
      label: "Webhooks",
      icon: Webhook,
      badge: "Beta",
    },
    {
      id: "apikeys",
      label: "API Keys",
      icon: Key,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const activeTab = useMemo<TabId>(() => {
    if (!orgSlug || !projectSlug) {
      return DEFAULT_TAB;
    }

    const basePath = `/${orgSlug}/project/${projectSlug}`;
    const normalizedPath = location.pathname.replace(/\/+$/, "");

    if (!normalizedPath.startsWith(basePath)) {
      return DEFAULT_TAB;
    }

    const remainder = normalizedPath.slice(basePath.length);
    if (!remainder || remainder === "" || remainder === "/") {
      return DEFAULT_TAB;
    }

    const segment = remainder.replace(/^\//, "").split("/")[0] || DEFAULT_TAB;

    if ((TAB_IDS as readonly string[]).includes(segment)) {
      return segment as TabId;
    }

    return DEFAULT_TAB;
  }, [location.pathname, orgSlug, projectSlug]);

  // Show loading while organization is being fetched
  if (currentOrg === undefined) {
    return <PageLoading />;
  }

  // Show error if organization not found
  if (currentOrg === null) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">{"No organization selected"}</p>
        </div>
      </div>
    );
  }

  // Show loading while project is being fetched
  if (project === undefined) {
    return <PageLoading />;
  }

  // Show error if project not found
  if (project === null) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">{"Project not found"}</p>
        </div>
      </div>
    );
  }

  const handleTabChange = (tabId: VisibleTabId) => {
    if (!orgSlug || !projectSlug) {
      return;
    }

    void navigate(`/${orgSlug}/project/${projectSlug}/${tabId}`);
  };

  // Layout note: this page used to wrap its content in a second
  // `overflow-y-auto` column so the header/tabs stayed pinned while
  // the body scrolled. That produced nested scroll containers against
  // the org-level <main>, and the inner could scroll past the visible
  // content while the outer still had room — the "empty space below
  // the last card" bug. The single scroll lives at the org layout
  // now; this component just flows naturally.
  //
  // `min-h-full` ensures the page covers the full main viewport even
  // when the form is shorter than the viewport — without it the user
  // saw a wide bg-background gap below the Save button when content
  // didn't reach the viewport bottom, which read as a layout bug.
  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                void navigate(`/${orgSlug}/projects`);
              }}
              className="p-2 hover:bg-muted rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold">{project.name}</h1>
                  {project.platform && (
                    <PlatformBadge platform={project.platform} size="sm" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {orgSlug}/{project.slug}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                  {tab.badge && (
                    <Badge variant="new" size="xs">
                      {tab.badge}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-7xl mx-auto p-8">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}
