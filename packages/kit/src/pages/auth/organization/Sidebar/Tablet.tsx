import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dropdown, type MenuProps } from "antd";
import {
  Package,
  FileText,
  Settings as SettingsIcon,
  CreditCard,
  ChevronLeft,
  User,
  Building2,
  LifeBuoy,
  LayoutDashboard,
} from "lucide-react";

import type { Id } from "@/convex";

interface TabletSidebarProps {
  orgSlug: string;
  organization: {
    _id: Id<"organizations">;
    name: string;
    slug: string;
  };
  organizations?: Array<{
    _id: Id<"organizations">;
    name: string;
    slug: string;
  }> | null;
  onSelectOrganization: (org: {
    _id: Id<"organizations">;
    slug: string;
  }) => Promise<void>;
  onCreateOrganization: () => void;
  profile?: {
    displayName?: string | null;
  } | null;
  loggedInUser?: {
    name?: string | null;
    email?: string | null;
  } | null;
}

export function TabletSidebar({
  orgSlug,
  organization,
  organizations,
  onSelectOrganization,
  onCreateOrganization,
  profile,
  loggedInUser,
}: TabletSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navigation = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: `/${orgSlug}`,
      badge: null,
    },
    {
      title: "Projects",
      icon: Package,
      path: `/${orgSlug}/projects`,
      badge: null,
    },
    {
      title: "Settings",
      icon: SettingsIcon,
      path: `/${orgSlug}/settings`,
      badge: null,
    },
    {
      title: "Usage",
      icon: CreditCard,
      path: `/${orgSlug}/usage`,
      badge: null,
    },
  ];

  const docsLabel = "Docs";
  const supportLabel = "Support";
  const supportPath = "/contact";
  const switchOrgLabel = "Switch organization";
  const createOrgLabel = "Create new organization";

  const handleDocsClick = () => {
    void navigate("/docs");
  };

  const handleSupportClick = () => {
    void navigate(supportPath);
  };

  const organizationMenu: MenuProps["items"] = useMemo(() => {
    const items: MenuProps["items"] = [
      ...(organizations ?? []).map((org) => ({
        key: org._id,
        label: (
          <button
            type="button"
            className="w-full text-left"
            onClick={(event) => {
              event.stopPropagation();
              void onSelectOrganization(org);
            }}
          >
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
              {org.name}
            </span>
            <span className="block text-xs text-muted-foreground break-words">
              {org.slug === orgSlug ? "Current" : org.slug}
            </span>
          </button>
        ),
      })),
      {
        type: "divider",
      },
      {
        key: "create",
        label: (
          <button
            type="button"
            className="w-full text-left text-primary hover:text-primary/80"
            onClick={(event) => {
              event.stopPropagation();
              onCreateOrganization();
            }}
          >
            {createOrgLabel}
          </button>
        ),
      },
    ];

    return items;
  }, [
    createOrgLabel,
    onCreateOrganization,
    onSelectOrganization,
    orgSlug,
    organizations,
  ]);

  return (
    <aside
      // Wheel events landing on the sidebar's bottom sections (Docs /
      // Support / Profile) sit outside the scrollable `<nav>`, so a
      // trackpad scroll there bubbles up to the document and scrolls
      // the adjacent main content. Making the aside itself a scroll
      // container (`overflow-y-auto`) + pinning `overscroll-contain`
      // absorbs those wheel events at the sidebar — the aside has
      // exactly viewport height, so no actual scroll happens, but the
      // browser stops propagating to main. `no-scrollbar` keeps the
      // visual unchanged.
      className={`hidden md:flex flex-col bg-card border-r-thin transition-all duration-300 overflow-y-auto overscroll-contain no-scrollbar ${
        isSidebarOpen ? "w-64" : "w-16"
      }`}
    >
      <div className="flex items-center justify-between h-14 px-4 border-b-thin">
        {isSidebarOpen ? (
          <Dropdown menu={{ items: organizationMenu }} trigger={["click"]}>
            <button
              type="button"
              onClick={(event) => event.preventDefault()}
              className="flex items-center gap-3 pr-2 min-w-0 w-full overflow-hidden"
            >
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="font-medium truncate whitespace-nowrap">
                  {organization.name}
                </span>
                <span className="text-xs text-muted-foreground truncate whitespace-nowrap">
                  {switchOrgLabel}
                </span>
              </div>
            </button>
          </Dropdown>
        ) : (
          <Dropdown menu={{ items: organizationMenu }} trigger={["click"]}>
            <button
              type="button"
              onClick={(event) => event.preventDefault()}
              className="flex items-center justify-center w-full"
            >
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </Dropdown>
        )}
        {isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 hover:bg-muted/50 rounded transition-colors"
          >
            <ChevronLeft
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                !isSidebarOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>

      {/* Toggle button when sidebar is closed */}
      {!isSidebarOpen && (
        <div className="p-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-full p-2 hover:bg-muted/50 rounded transition-colors"
            title="Expand sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 mx-auto" />
          </button>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              onClick={() => void navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {isSidebarOpen && (
                <>
                  <span className="flex-1 text-left">{item.title}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded font-medium">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Docs & Support links */}
      <div className="p-3 border-t-thin">
        <div
          className={`flex flex-col gap-2 ${isSidebarOpen ? "" : "items-center"}`}
        >
          <button
            onClick={handleDocsClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${
              isSidebarOpen ? "" : "justify-center"
            }`}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen ? (
              <span className="font-medium">{docsLabel}</span>
            ) : (
              <span className="sr-only">{docsLabel}</span>
            )}
          </button>
          <button
            onClick={handleSupportClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${
              isSidebarOpen ? "" : "justify-center"
            }`}
          >
            <LifeBuoy className="w-4 h-4 flex-shrink-0" />
            {isSidebarOpen ? (
              <span className="font-medium">{supportLabel}</span>
            ) : (
              <span className="sr-only">{supportLabel}</span>
            )}
          </button>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-3 border-t-thin">
        <button
          onClick={() => void navigate("/profile")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-muted transition-colors ${
            isSidebarOpen ? "" : "justify-center"
          }`}
        >
          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </div>
          {isSidebarOpen && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {profile?.displayName || loggedInUser?.name || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {loggedInUser?.email}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
