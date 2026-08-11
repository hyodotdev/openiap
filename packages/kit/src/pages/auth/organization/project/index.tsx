import { useEffect, useMemo, useRef } from "react";
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
  ReceiptText,
} from "lucide-react";
import { PageLoading } from "@/components/LoadingSpinner";

import { api } from "@/convex";

const TAB_IDS = [
  "dashboard",
  "purchases",
  "subscriptions",
  "orders",
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
      id: "orders",
      label: "Orders",
      icon: ReceiptText,
      badge: "Beta",
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
  const tabScrollerRef = useRef<HTMLDivElement>(null);
  const activeTabButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const scroller = tabScrollerRef.current;
    const activeButton = activeTabButtonRef.current;
    if (!scroller || !activeButton) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const activeButtonRect = activeButton.getBoundingClientRect();
    const leftOverflow = activeButtonRect.left - scrollerRect.left;
    const rightOverflow = activeButtonRect.right - scrollerRect.right;

    if (leftOverflow < 0) {
      scroller.scrollLeft += leftOverflow;
    } else if (rightOverflow > 0) {
      scroller.scrollLeft += rightOverflow;
    }
  }, [activeTab, project?._id]);

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
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              aria-label="Back to projects"
              onClick={() => {
                void navigate(`/${orgSlug}/projects`);
              }}
              className="shrink-0 p-2 hover:bg-muted rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <h1
                    className="min-w-0 flex-1 truncate text-xl font-semibold"
                    title={project.name}
                  >
                    {project.name}
                  </h1>
                  {project.platform && (
                    <PlatformBadge
                      platform={project.platform}
                      size="sm"
                      className="shrink-0"
                    />
                  )}
                </div>
                <p
                  className="truncate text-sm text-muted-foreground"
                  title={`${orgSlug}/${project.slug}`}
                >
                  {orgSlug}/{project.slug}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Keep wide project navigation in its own horizontal scroller.
            Otherwise `<main>` becomes the scroller and shifts the page body
            underneath the fixed-width organization sidebar. */}
        <div
          ref={tabScrollerRef}
          className="container max-w-7xl mx-auto px-4 overflow-x-auto overscroll-x-contain"
        >
          <nav
            aria-label="Project sections"
            className="flex w-max min-w-full gap-1"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={isActive ? activeTabButtonRef : undefined}
                  onClick={() => handleTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 border-b-2 transition-colors ${
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
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-7xl min-w-0 mx-auto p-8">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}
