import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex";
import { toast } from "sonner";
import { Building2, ArrowRight, LogOut } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

export default function CreateOrganization() {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const createOrganization = useMutation(
    api.organizations.mutation.createOrganization,
  );

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsCreating(true);
    try {
      await createOrganization({
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
      });
      trackEvent(MixpanelEvent.OrganizationCreated);

      toast.success("Organization created successfully!");
      // Navigate to plan selection onboarding step
      void navigate("/onboarding/plan");
    } catch (error) {
      toast.error("Failed to create organization");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-generate slug from name only if not manually edited
      slug: !slugManuallyEdited
        ? name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
        : prev.slug,
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlugManuallyEdited(true); // Mark as manually edited
    setFormData((prev) => ({
      ...prev,
      slug,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      {/* Sign out button in top right */}
      <button
        onClick={() => {
          void signOut().then(() => {
            void navigate("/");
          });
        }}
        className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-2 text-sm"
        title={"Sign out"}
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">{"Sign out"}</span>
      </button>

      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {"Create Your Organization"}
          </h1>
          <p className="text-muted-foreground">
            {
              "Organizations help you manage projects and collaborate with your team"
            }
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
          className="space-y-6"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              {"Organization Name"}
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              className="input w-full"
              placeholder={"Hyo Dev"}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              {"This is your organization's display name"}
            </p>
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium mb-2">
              {"Organization URL"}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                kit.openiap.dev/
              </span>
              <input
                id="slug"
                type="text"
                value={formData.slug}
                onChange={handleSlugChange}
                className="input flex-1"
                placeholder={"hyodev"}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {"This will be your organization's unique URL"}
            </p>
          </div>

          <button
            type="submit"
            disabled={
              isCreating || !formData.name.trim() || !formData.slug.trim()
            }
            className="w-full btn-gradient gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {isCreating ? (
              "Creating..."
            ) : (
              <>
                {"Create Organization"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
