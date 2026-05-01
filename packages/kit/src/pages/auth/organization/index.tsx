import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Menu, Building2 } from "lucide-react";
import { ThemeDropdown } from "../../../components/ThemeDropdown";
import { SignOutButton } from "../../../components/SignOutButton";
import { FreeTransitionNotice } from "../../../components/FreeTransitionNotice";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex";
import type { Id } from "@/convex";
import { useUserProfile } from "../../../hooks/useUserProfile";
import { MobileSidebar, TabletSidebar } from "./Sidebar";

export default function OrganizationLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const { profile } = useUserProfile();
  const organizations = useQuery(api.organizations.query.getUserOrganizations);
  const switchOrganization = useMutation(
    api.organizations.mutation.switchOrganization,
  );

  // Get organization by slug
  const organization = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );

  const orgOptions = useMemo(() => {
    if (!organizations) return organizations ?? [];

    const safeOrgs = organizations.filter(
      (org): org is NonNullable<(typeof organizations)[number]> => Boolean(org),
    );

    return safeOrgs.map((org) => ({
      _id: org._id,
      name: org.name,
      slug: org.slug,
    }));
  }, [organizations]);

  const handleSelectOrganization = useCallback(
    async (org: { _id: Id<"organizations">; slug: string }) => {
      if (!org?._id) return;

      const shouldSwitch =
        organization && organization._id && organization._id !== org._id;

      if (shouldSwitch) {
        await switchOrganization({ organizationId: org._id });
      }

      void navigate(`/${org.slug}`);
    },
    [navigate, organization, switchOrganization],
  );

  const handleCreateOrganization = useCallback(() => {
    void navigate("/onboarding/create-organization");
  }, [navigate]);

  // Auto-switch to this organization when it loads (only if needed)
  useEffect(() => {
    const shouldSwitch =
      organization &&
      organization._id &&
      profile?.currentOrganizationId &&
      profile.currentOrganizationId !== organization._id;

    if (shouldSwitch) {
      void switchOrganization({ organizationId: organization._id });
    }
  }, [organization, profile?.currentOrganizationId, switchOrganization]);

  // Show loading state with proper background
  if (organization === undefined || !orgSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {"Loading organization..."}
          </p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{"Organization not found"}</p>
          <button
            onClick={() => void navigate("/")}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            {"Go to Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  const navigation = [
    {
      title: "Dashboard",
      path: `/${orgSlug}`,
    },
    {
      title: "Projects",
      path: `/${orgSlug}/projects`,
    },
    {
      title: "Settings",
      path: `/${orgSlug}/settings`,
    },
    {
      title: "Plan & Billing",
      path: `/${orgSlug}/plan`,
    },
  ];

  return (
    <div className="h-screen flex bg-background">
      {/* Tablet and Desktop Sidebar */}
      <TabletSidebar
        orgSlug={orgSlug}
        organization={organization}
        organizations={orgOptions}
        onSelectOrganization={handleSelectOrganization}
        onCreateOrganization={handleCreateOrganization}
        profile={profile}
        loggedInUser={loggedInUser}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        orgSlug={orgSlug}
        organization={organization}
        organizations={orgOptions}
        onSelectOrganization={handleSelectOrganization}
        onCreateOrganization={handleCreateOrganization}
        profile={profile}
        loggedInUser={loggedInUser}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-card border-b-thin px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-muted/50 rounded transition-colors"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {navigation.find((item) =>
                location.pathname.startsWith(item.path),
              )?.title || ""}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeDropdown />
            <SignOutButton />
          </div>
        </header>

        {/* Main Content: single scroll container for every page under
            this layout. Sidebar + top header stay pinned (they live
            outside this <main>), so only the content column scrolls.
            Child pages should NOT add their own `overflow-y-auto` —
            nested scrolls previously caused the inner container to
            scroll past the visible content while the outer still had
            room to move. */}
        <main className="flex-1 overflow-y-auto bg-background">
          <FreeTransitionNotice
            hadBillingRelationship={Boolean(
              organization.stripeCustomerId ||
              organization.stripeSubscriptionId,
            )}
          />
          <Outlet />
          {/* Trailing spacer so the last page row doesn't sit flush
              against the viewport at scroll-end. `pb-*` on the scroll
              container itself gets trimmed by a Blink/WebKit quirk,
              so use a real in-flow block here. */}
          <div aria-hidden style={{ height: "80px" }} />
        </main>
      </div>
    </div>
  );
}
