import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "@/convex";
import type { Id } from "@/convex";
import { toast } from "sonner";
import { CustomDropdown } from "../../../components/CustomDropdown";
import { ButtonPrimary } from "@/components/ButtonPrimary";
import {
  Building2,
  Users,
  Plus,
  Crown,
  Shield,
  User,
  Trash2,
  Save,
} from "lucide-react";

type OrganizationMember = {
  userId: Id<"users">;
  email: string | null;
  name: string | null;
  role: "owner" | "admin" | "member";
  joinedAt?: number | null;
};

export default function OrganizationSettings() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const currentOrg = useQuery(
    api.organizations.query.getOrganizationBySlug,
    orgSlug ? { slug: orgSlug } : "skip",
  );
  const membersQuery = useQuery(
    api.organizations.query.getOrganizationMembers,
    currentOrg ? { organizationId: currentOrg._id } : "skip",
  ) as OrganizationMember[] | undefined;
  const members = membersQuery ?? [];

  const updateOrganization = useMutation(
    api.organizations.mutation.updateOrganization,
  );
  const inviteMember = useMutation(api.organizations.mutation.inviteMember);
  const removeMember = useMutation(api.organizations.mutation.removeMember);
  const [isEditing, setIsEditing] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when organization loads
  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setBillingEmail(currentOrg.billingEmail || "");
      setTaxId(currentOrg.taxId || "");
    }
  }, [currentOrg]);

  const handleUpdateOrganization = async () => {
    if (!currentOrg) return;

    setIsSaving(true);
    try {
      await updateOrganization({
        organizationId: currentOrg._id,
        name: orgName.trim() || undefined,
        billingEmail: billingEmail.trim() || undefined,
        taxId: taxId.trim() || null,
      });
      toast.success("Organization updated successfully");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update organization");
    } finally {
      setIsSaving(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !inviteEmail.trim() ||
      !currentOrg ||
      !validateEmail(inviteEmail.trim())
    )
      return;

    setIsInviting(true);
    try {
      await inviteMember({
        organizationId: currentOrg._id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success("Member invited successfully");
      setInviteEmail("");
      setInviteRole("member");
    } catch (error: any) {
      // Handle specific error codes with i18n - only show one toast
      if (error?.message) {
        if (error.message.includes("USER_NOT_REGISTERED")) {
          toast.error(
            "This user is not registered on IAPKit. Please ask them to sign up first.",
          );
        } else if (error.message.includes("USER_ALREADY_MEMBER")) {
          toast.error("This user is already a member of this organization.");
        } else if (error.message.includes("INSUFFICIENT_PERMISSIONS")) {
          toast.error("You don't have permission to perform this action.");
        } else {
          toast.error("Failed to invite member");
        }
      }
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: Id<"users">, userName: string) => {
    if (!currentOrg) return;

    if (
      !confirm(
        `Are you sure you want to remove ${userName} from the organization?`,
      )
    ) {
      return;
    }

    try {
      await removeMember({
        organizationId: currentOrg._id,
        userId,
      });
      toast.success("Member removed successfully");
    } catch (error: any) {
      // Handle specific error codes with i18n
      if (
        error?.message &&
        error.message.includes("INSUFFICIENT_PERMISSIONS")
      ) {
        toast.error("You don't have permission to perform this action.");
      } else if (
        error?.message &&
        error.message.includes("CANNOT_REMOVE_OWNER")
      ) {
        toast.error("Cannot remove the last owner of the organization.");
      } else {
        toast.error("Failed to remove member");
      }
    }
  };

  if (!currentOrg) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="text-center py-16">
          <p className="text-muted-foreground">{"No organization selected"}</p>
        </div>
      </div>
    );
  }

  const canEdit = currentOrg.role === "owner" || currentOrg.role === "admin";

  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{"Organization Settings"}</h1>
          <p className="text-muted-foreground">
            {"Manage your organization and team members"}
          </p>
        </div>
      </div>

      {/* Organization Details */}
      <div className="bg-card rounded border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{"Organization Details"}</h2>
          {canEdit && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              {"Edit"}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {"Organization Name"}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={"Example Inc."}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {"Billing Email"}
              </label>
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={"billing@example.com"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                {"Tax ID"}
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={"e.g. 123456789"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {"Shown on invoices and sent to Stripe."}
              </p>
            </div>
            <div className="flex gap-3">
              <ButtonPrimary
                type="button"
                onClick={() => {
                  void handleUpdateOrganization();
                }}
                loading={isSaving}
                disabled={isSaving}
              >
                {isSaving ? (
                  "Saving..."
                ) : (
                  <>
                    {"Save Changes"}
                    <Save className="w-4 h-4" />
                  </>
                )}
              </ButtonPrimary>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setOrgName(currentOrg.name);
                  setBillingEmail(currentOrg.billingEmail || "");
                  setTaxId(currentOrg.taxId || "");
                }}
                className="btn-ghost"
              >
                {"Cancel"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{"Name"}</p>
              <p className="font-medium">{currentOrg.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{"URL"}</p>
              <p>
                <a
                  href={`https://kit.openiap.dev/${currentOrg.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  kit.openiap.dev/{currentOrg.slug}
                </a>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{"Billing Email"}</p>
              <p className="font-medium">
                {currentOrg.billingEmail || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{"Tax ID"}</p>
              <p className="font-medium">{currentOrg.taxId || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{"Your Role"}</p>
              <div className="flex items-center gap-2">
                {currentOrg.role === "owner" && (
                  <>
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="font-medium">{"Owner"}</span>
                  </>
                )}
                {currentOrg.role === "admin" && (
                  <>
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{"Admin"}</span>
                  </>
                )}
                {currentOrg.role === "member" && (
                  <>
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{"Member"}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-card rounded border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">{"Team Members"}</h2>
            <span className="text-sm text-muted-foreground">
              ({members.length})
            </span>
          </div>
        </div>

        {/* Invite Form */}
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleInviteMember(e);
            }}
            className="mb-6 p-4 bg-muted rounded border border-border"
          >
            <h3 className="font-medium mb-3">{"Invite New Member"}</h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={"member@example.com"}
                required
              />
              <CustomDropdown
                value={inviteRole}
                onChange={(value) => setInviteRole(value as "admin" | "member")}
                options={[
                  {
                    value: "member",
                    label: "Member",
                  },
                  {
                    value: "admin",
                    label: "Admin",
                  },
                ]}
              />
              <button
                type="submit"
                disabled={
                  isInviting ||
                  !inviteEmail.trim() ||
                  !validateEmail(inviteEmail.trim())
                }
                className="btn-primary"
              >
                {isInviting ? (
                  "Inviting..."
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {"Invite"}
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Members List */}
        <div className="space-y-3">
          {members.map((member) => {
            const nameInitial =
              member.name && member.name.trim().length > 0
                ? member.name.trim().charAt(0).toUpperCase()
                : null;
            const fallbackInitial =
              !nameInitial && member.email && member.email.trim().length > 0
                ? member.email.trim().charAt(0).toUpperCase()
                : null;
            const displayInitial = nameInitial || fallbackInitial;

            return (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 bg-card rounded border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    {displayInitial ? (
                      <span className="text-sm font-semibold text-primary">
                        {displayInitial}
                      </span>
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.name || "Unknown User"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.email || "No email"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {member.role === "owner" && (
                      <>
                        <Crown className="w-4 h-4 text-amber-500" />
                        <span className="text-sm">{"Owner"}</span>
                      </>
                    )}
                    {member.role === "admin" && (
                      <>
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">{"Admin"}</span>
                      </>
                    )}
                    {member.role === "member" && (
                      <>
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{"Member"}</span>
                      </>
                    )}
                  </div>
                  {canEdit && member.role !== "owner" && (
                    <button
                      onClick={() => {
                        void handleRemoveMember(
                          member.userId,
                          member.name || "Unknown User",
                        );
                      }}
                      className="p-1 hover:bg-muted rounded transition-colors text-destructive"
                      title={"Remove member"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
