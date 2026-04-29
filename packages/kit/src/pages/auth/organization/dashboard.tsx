import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex";
import {
  Package,
  Users,
  Key,
  ArrowRight,
  Activity,
  Shield,
} from "lucide-react";

export default function OrganizationDashboard() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();

  // Get organization data
  const organization = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );

  // Get projects for this organization
  const projects = useQuery(
    api.projects.query.listOrganizationProjects,
    organization ? { organizationId: organization._id } : "skip",
  );

  // Get organization members
  const members = useQuery(
    api.organizations.query.listOrganizationMembers,
    organization ? { organizationId: organization._id } : "skip",
  );

  const organizationReceiptStats = useQuery(
    api.purchases.query.getOrganizationReceiptStats,
    organization ? { organizationId: organization._id } : "skip",
  );

  if (!organization || !orgSlug) {
    return (
      <div className="container max-w-7xl mx-auto py-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">{"Loading organization..."}</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: "Projects",
      value: projects?.length || 0,
      icon: Package,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Team Members",
      value: members?.length || 0,
      icon: Users,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Active API Keys",
      value: projects?.reduce((acc, p) => acc + (p.apiKey ? 1 : 0), 0) || 0,
      icon: Key,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total Validations",
      value:
        organizationReceiptStats === undefined
          ? "—"
          : (organizationReceiptStats?.total ?? 0).toLocaleString(),
      icon: Shield,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  const quickActions = [
    {
      title: "Create Project",
      description: "Start a new project for your app",
      icon: Package,
      action: () => void navigate(`/${orgSlug}/projects`),
      color: "text-blue-500",
    },
    {
      title: "Invite Team",
      description: "Add team members to collaborate",
      icon: Users,
      action: () => void navigate(`/${orgSlug}/settings`),
      color: "text-green-500",
    },
    {
      title: "View Documentation",
      description: "Learn how to integrate IAPKit",
      icon: Activity,
      action: () => navigate("/docs"),
      color: "text-purple-500",
    },
  ];

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          {`Welcome to ${organization.name}`}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {"Here's an overview of your organization"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isProjects = index === 0;
          const isTeamMembers = index === 1;
          const isClickable = isProjects || isTeamMembers;

          const handleClick = () => {
            if (isProjects) {
              void navigate(`/${orgSlug}/projects`);
            } else if (isTeamMembers) {
              void navigate(`/${orgSlug}/settings`);
            }
          };

          return (
            <div
              key={stat.title}
              onClick={isClickable ? handleClick : undefined}
              className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm ${
                isClickable
                  ? "cursor-pointer hover:shadow-md transition-shadow"
                  : ""
              }`}
            >
              <div className="mb-4">
                <div
                  className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stat.title}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          {"Quick Actions"}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                onClick={() => void action.action()}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-sm transition-all group shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center ${action.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="font-semibold mb-1 text-gray-900 dark:text-gray-100">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {action.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
