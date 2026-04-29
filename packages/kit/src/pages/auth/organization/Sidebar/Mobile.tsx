import { useNavigate, useLocation } from "react-router-dom";
import { Dropdown, type MenuProps } from "antd";
import {
  Package,
  FileText,
  Settings as SettingsIcon,
  CreditCard,
  User,
  Building2,
  LifeBuoy,
  LayoutDashboard,
} from "lucide-react";

import type { Id } from "@/convex";

interface MobileSidebarProps {
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
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({
  orgSlug,
  organization,
  organizations,
  onSelectOrganization,
  onCreateOrganization,
  profile,
  loggedInUser,
  isOpen,
  onClose,
}: MobileSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

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
    onClose();
  };

  const handleSupportClick = () => {
    void navigate(supportPath);
    onClose();
  };

  const organizationMenu: MenuProps["items"] = [
    ...(organizations ?? []).map((org) => ({
      key: org._id,
      label: (
        <button
          type="button"
          className="w-full text-left"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
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
            onClose();
            onCreateOrganization();
          }}
        >
          {createOrgLabel}
        </button>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`md:hidden fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 z-50 transform transition-transform shadow-lg ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700">
          <Dropdown menu={{ items: organizationMenu }} trigger={["click"]}>
            <button
              type="button"
              onClick={(event) => event.preventDefault()}
              className="flex items-center gap-3 pr-2 min-w-0 w-full overflow-hidden"
            >
              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate whitespace-nowrap">
                  {organization.name}
                </span>
                <span className="text-xs text-muted-foreground truncate whitespace-nowrap">
                  {switchOrgLabel}
                </span>
              </div>
            </button>
          </Dropdown>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => {
                  void navigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.title}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded font-medium">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Docs link */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-2">
            <button
              onClick={handleDocsClick}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{docsLabel}</span>
            </button>
            <button
              onClick={handleSupportClick}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LifeBuoy className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{supportLabel}</span>
            </button>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              void navigate("/profile");
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {profile?.displayName || loggedInUser?.name || "User"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {loggedInUser?.email}
              </p>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
