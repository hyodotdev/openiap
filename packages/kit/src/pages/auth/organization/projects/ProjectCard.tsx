import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex";
import { PlatformBadge } from "../../../../components/Badge";
import { MoreVertical, Trash2, Calendar, ArrowRight } from "lucide-react";

interface ProjectCardProps {
  project: {
    _id: Id<"projects">;
    name: string;
    slug: string;
    platform?: string;
    createdAt: number;
  };
  orgSlug: string;
  onDeleteProject: (
    projectId: Id<"projects">,
    projectName: string,
  ) => Promise<void>;
}

export default function ProjectCard({
  project,
  orgSlug,
  onDeleteProject,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on menu or buttons
    const target = e.target;
    if (target instanceof HTMLElement && target.closest("button")) {
      return;
    }
    void navigate(`/${orgSlug}/project/${project.slug}`);
  };

  const handleDelete = () => {
    void onDeleteProject(project._id, project.name);
    setShowProjectMenu(false);
  };

  return (
    <div
      className="bg-card rounded-lg border-thin p-6 relative cursor-pointer hover:shadow-sm transition-shadow"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-xs text-muted-foreground">
            {orgSlug}/{project.slug}
          </p>
          {project.platform && (
            <div className="mt-2">
              <PlatformBadge platform={project.platform} size="xs" />
            </div>
          )}
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowProjectMenu(!showProjectMenu);
            }}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showProjectMenu && (
            <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                {"Delete Project"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Created Date */}
        <div className="pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              {"Created"} {new Date(project.createdAt).toLocaleDateString()}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
