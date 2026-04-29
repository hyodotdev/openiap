import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex";
import { useAuthActions } from "@convex-dev/auth/react";
import { useUserProfile } from "../../hooks/useUserProfile";
import {
  User,
  Mail,
  Shield,
  Save,
  RefreshCw,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const { signOut } = useAuthActions();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const { profile, stats } = useUserProfile();
  const currentOrganization = useQuery(
    api.organizations.query.getCurrentOrganization,
    { organizationId: undefined },
  );
  const deleteAccountMutation = useMutation(
    api.userProfiles.mutation.deleteAccount,
  );
  const updateDisplayNameMutation = useMutation(
    api.userProfiles.mutation.updateDisplayName,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  useEffect(() => {
    setDisplayName(profile?.displayName || "");
  }, [profile?.displayName]);

  const fallbackConfirmationToken = "DELETE MY ACCOUNT";
  const organizationName = currentOrganization?.name?.trim();
  const confirmationToken =
    organizationName && organizationName.length > 0
      ? organizationName
      : fallbackConfirmationToken;
  const normalizedConfirmationToken = confirmationToken.toLowerCase();
  const trimmedDeleteConfirmation = deleteConfirmation.trim().toLowerCase();
  const isDeleteConfirmationValid =
    trimmedDeleteConfirmation === normalizedConfirmationToken;

  useEffect(() => {
    setDeleteConfirmation("");
  }, [confirmationToken]);

  const handleSaveProfile = async () => {
    if (!isEditing) {
      return;
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast.error("Failed to update profile");
      return;
    }

    if (trimmedName === (profile?.displayName || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayNameMutation({ displayName: trimmedName });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) {
      return;
    }

    if (!isDeleteConfirmationValid) {
      toast.error(`Enter "${confirmationToken}" to delete your account.`);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone and organizations without other members will also be deleted.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccountMutation();
      toast.success("Your account has been deleted.");
      await signOut();
      void navigate("/");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete your account.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-8">
      {/* Back Button */}
      <button
        onClick={() => void navigate(-1)}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {"Back"}
      </button>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{"Profile"}</h1>
          <p className="text-muted-foreground mt-1">
            {"Manage your personal information and preferences"}
          </p>
        </div>
        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="btn-primary">
            {"Edit Profile"}
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-4">
                <User className="w-16 h-16 text-muted-foreground" />
              </div>

              <h2 className="text-xl font-semibold">
                {profile?.displayName || loggedInUser?.name || "User"}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="w-3 h-3" />
                {loggedInUser?.email}
              </p>
            </div>
          </div>

          {/* Account Status */}
          <div className="card p-6 mt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {"Account Status"}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {"Email Verified"}
                </span>
                <span className="badge-primary text-xs">{"Verified"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {"Account Type"}
                </span>
                <span className="text-sm font-medium">
                  {stats?.subscriptionTier || "Developer"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {"Member Since"}
                </span>
                <span className="text-sm">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-6">
              {"Personal Information"}
            </h3>

            <div className="space-y-6">
              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {"Display Name"}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input w-full"
                    placeholder={"Your display name"}
                  />
                ) : (
                  <p className="text-sm">{profile?.displayName || "—"}</p>
                )}
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      void handleSaveProfile();
                    }}
                    disabled={isSaving || !displayName.trim()}
                    className="btn-gradient gap-2"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {"Saving..."}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {"Save Changes"}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(profile?.displayName || "");
                    }}
                    className="btn-ghost"
                  >
                    {"Cancel"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card p-6 mt-6 border-destructive/20">
            <h3 className="text-lg font-semibold mb-4 text-destructive">
              {"Danger Zone"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {"Irreversible actions that affect your account"}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {`Type "${confirmationToken}" below to confirm`}
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className={`input ${
                    deleteConfirmation.trim().length > 0 &&
                    !isDeleteConfirmationValid
                      ? "border-destructive focus-visible:ring-destructive/40"
                      : ""
                  }`}
                  aria-describedby="delete-confirmation-description"
                  aria-invalid={
                    deleteConfirmation.trim().length > 0 &&
                    !isDeleteConfirmationValid
                  }
                />
                <p
                  id="delete-confirmation-description"
                  className="text-xs text-muted-foreground mt-2"
                >
                  {`Please type "${confirmationToken}" below to enable deletion. This check is not case sensitive.`}
                </p>
                {deleteConfirmation.trim().length > 0 &&
                  !isDeleteConfirmationValid && (
                    <p className="text-xs text-destructive mt-1">
                      {`The value must match "${confirmationToken}".`}
                    </p>
                  )}
              </div>
              <button
                className="btn-destructive gap-2"
                onClick={() => void handleDeleteAccount()}
                disabled={isDeleting || !isDeleteConfirmationValid}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {"Deleting..."}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {"Delete Account"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
