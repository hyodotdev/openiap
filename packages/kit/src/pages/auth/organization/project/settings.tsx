import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api, Id } from "@/convex";
import {
  Upload,
  Apple,
  Smartphone,
  FileText,
  CheckCircle,
  AlertCircle,
  Info,
  Trash2,
  HelpCircle,
} from "lucide-react";
import { GuideModal } from "../../../../components/GuideModal";
import { PageLoading } from "@/components/LoadingSpinner";
import { ButtonPrimary } from "@/components/ButtonPrimary";

const androidPackagePattern =
  /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const iosBundlePattern = /^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)+$/;
const appStoreIssuerPattern =
  /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const appStoreKeyPattern = /^[A-Z0-9]{10}$/;

interface ProjectData {
  _id: Id<"projects">;
  organizationId: Id<"organizations">;
  name: string;
  slug: string;
  apiKey: string;
  platform?: string;
  androidPackageName?: string;
  iosBundleId?: string;
  iosAppAppleId?: number;
  iosAppStoreIssuerId?: string;
  iosAppStoreKeyId?: string;
  horizonEnabled?: boolean;
  horizonAppId?: string | null;
  // The Meta App Secret is never returned by
  // `api.projects.query.getProject` — the server redacts it so a
  // dashboard member can't exfiltrate the Horizon credential via the
  // browser (see convex/projects/query.ts). All we surface is
  // whether one is configured, so the UI can show "Configured /
  // Replace" instead of a prefilled password field.
  hasHorizonAppSecret?: boolean;
}

interface OutletContext {
  project: ProjectData;
}

export default function ProjectSettings() {
  const { project } = useOutletContext<OutletContext>();
  const [iosFileUploaded, setIosFileUploaded] = useState(false);
  const [androidFileUploaded, setAndroidFileUploaded] = useState(false);
  const [uploadingIos, setUploadingIos] = useState(false);
  const [uploadingAndroid, setUploadingAndroid] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [applePlatformsSelected, setApplePlatformsSelected] = useState(
    Boolean(
      project?.iosBundleId ||
      project?.iosAppAppleId ||
      project?.iosAppStoreIssuerId ||
      project?.iosAppStoreKeyId,
    ),
  );
  const [androidPlatformsSelected, setAndroidPlatformsSelected] = useState(
    Boolean(project?.androidPackageName),
  );
  const [androidPackageName, setAndroidPackageName] = useState(
    project?.androidPackageName ?? "",
  );
  const [iosBundleId, setIosBundleId] = useState(project?.iosBundleId ?? "");
  const [iosAppAppleId, setIosAppAppleId] = useState(
    project?.iosAppAppleId ? String(project.iosAppAppleId) : "",
  );
  const [iosAppStoreIssuerId, setIosAppStoreIssuerId] = useState(
    project?.iosAppStoreIssuerId ?? "",
  );
  const [iosAppStoreKeyId, setIosAppStoreKeyId] = useState(
    project?.iosAppStoreKeyId ?? "",
  );
  // Meta Horizon — gated by a checkbox inside the Android card.
  // The enabled flag is the single source of truth: toggling off
  // clears the credential fields on save so stale secrets can't
  // linger in the DB after the user deselected Horizon.
  const [horizonEnabled, setHorizonEnabled] = useState(
    Boolean(project?.horizonEnabled),
  );
  const [horizonAppId, setHorizonAppId] = useState(project?.horizonAppId ?? "");
  // Secret is ALWAYS empty on mount: the server redacts it from the
  // query so we never receive it in the browser. `isReplacingHorizonAppSecret`
  // toggles between the "Configured ✓ / Replace" affordance and the
  // password input. Saving without replacing is a no-op for the
  // secret field — existing stays untouched.
  const [horizonAppSecret, setHorizonAppSecret] = useState("");
  const [isReplacingHorizonAppSecret, setIsReplacingHorizonAppSecret] =
    useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [savingHorizon, setSavingHorizon] = useState(false);

  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.mutation.generateUploadUrl);
  const saveFile = useMutation(api.files.mutation.saveFile);
  const removeFile = useMutation(api.files.mutation.remove);
  const updateProject = useMutation(api.projects.mutation.updateProject);

  const originalAndroidPackageName = project?.androidPackageName ?? "";
  const originalIosBundleId = project?.iosBundleId ?? "";
  const originalIosAppleIdString =
    project?.iosAppAppleId !== undefined && project?.iosAppAppleId !== null
      ? String(project.iosAppAppleId)
      : "";
  const originalIosIssuerId = project?.iosAppStoreIssuerId ?? "";
  const originalIosKeyId = project?.iosAppStoreKeyId ?? "";
  const originalHorizonEnabled = Boolean(project?.horizonEnabled);
  const originalHorizonAppId = project?.horizonAppId ?? "";
  const hasHorizonAppSecretConfigured = Boolean(project?.hasHorizonAppSecret);

  useEffect(() => {
    if (!project) {
      return;
    }
    setAndroidPackageName(originalAndroidPackageName);
    setIosBundleId(originalIosBundleId);
    setIosAppAppleId(originalIosAppleIdString);
    setIosAppStoreIssuerId(originalIosIssuerId);
    setIosAppStoreKeyId(originalIosKeyId);
    setHorizonEnabled(originalHorizonEnabled);
    setHorizonAppId(originalHorizonAppId);
    // Secret is write-only; we never receive the existing value, so
    // reset the input to empty on project refetch to avoid stale
    // user-typed input silently being re-submitted.
    setHorizonAppSecret("");
    setIsReplacingHorizonAppSecret(false);
  }, [
    project,
    originalAndroidPackageName,
    originalIosBundleId,
    originalIosAppleIdString,
    originalIosIssuerId,
    originalIosKeyId,
    originalHorizonEnabled,
    originalHorizonAppId,
    hasHorizonAppSecretConfigured,
  ]);

  const trimmedAndroidPackageName = androidPackageName.trim();
  const trimmedIosBundleId = iosBundleId.trim();
  const trimmedIosAppleId = iosAppAppleId.trim();
  const trimmedIosIssuerId = iosAppStoreIssuerId.trim();
  const trimmedIosKeyId = iosAppStoreKeyId.trim().toUpperCase();
  const trimmedHorizonAppId = horizonAppId.trim();
  const trimmedHorizonAppSecret = horizonAppSecret.trim();

  // Query existing files
  const files = useQuery(
    api.files.query.list,
    project ? { organizationId: project.organizationId } : "skip",
  );

  // Get existing files
  const iosFile = files?.find(
    (file) =>
      file.purpose === "apple_p8_key" && file.projectId === project?._id,
  );
  const androidFile = files?.find(
    (file) =>
      file.purpose === "android_service_account" &&
      file.projectId === project?._id,
  );

  const hasIosFile = !!iosFile;
  const hasAndroidFile = !!androidFile;

  const iosBundleLocked = Boolean(originalIosBundleId);
  const iosAppleIdLocked = Boolean(originalIosAppleIdString);
  const iosIssuerLocked = Boolean(originalIosIssuerId);
  const iosKeyLocked = Boolean(originalIosKeyId);
  const androidPackageLocked = Boolean(originalAndroidPackageName);
  const isIosP8Provided = hasIosFile || iosFileUploaded;

  const derivedAppleSupport =
    Boolean(project?.iosBundleId?.trim()) ||
    (project?.iosAppAppleId !== undefined && project?.iosAppAppleId !== null) ||
    Boolean(project?.iosAppStoreIssuerId?.trim()) ||
    Boolean(project?.iosAppStoreKeyId?.trim()) ||
    isIosP8Provided;
  const derivedAndroidSupport =
    Boolean(project?.androidPackageName?.trim()) ||
    hasAndroidFile ||
    androidFileUploaded;

  useEffect(() => {
    setApplePlatformsSelected((current) =>
      current === derivedAppleSupport ? current : derivedAppleSupport,
    );
  }, [derivedAppleSupport]);

  useEffect(() => {
    setAndroidPlatformsSelected((current) =>
      current === derivedAndroidSupport ? current : derivedAndroidSupport,
    );
  }, [derivedAndroidSupport]);

  if (!project) {
    return <PageLoading />;
  }

  // Wait for file queries to complete before rendering
  if (files === undefined) {
    return <PageLoading />;
  }

  const applePlatformsLocked = iosBundleLocked || iosAppleIdLocked;
  const androidPlatformsLocked = androidPackageLocked;

  const showAppleSection = applePlatformsSelected;
  const showAndroidSection = androidPlatformsSelected;
  const configurationGridColumns =
    showAppleSection && showAndroidSection
      ? "md:grid-cols-2"
      : "md:grid-cols-1";

  const isAndroidPackageValid =
    !showAndroidSection ||
    androidPackageLocked ||
    (trimmedAndroidPackageName.length > 0 &&
      androidPackagePattern.test(trimmedAndroidPackageName));
  const isIosBundleValid =
    !showAppleSection ||
    iosBundleLocked ||
    (trimmedIosBundleId.length > 0 &&
      iosBundlePattern.test(trimmedIosBundleId));
  const isIosAppleIdValid =
    !showAppleSection ||
    iosAppleIdLocked ||
    trimmedIosAppleId === "" ||
    /^\d+$/.test(trimmedIosAppleId);
  const isIosIssuerIdValid =
    !showAppleSection || appStoreIssuerPattern.test(trimmedIosIssuerId);
  const isIosKeyIdValid =
    !showAppleSection || appStoreKeyPattern.test(trimmedIosKeyId);
  const iosCredentialsProvided =
    trimmedIosIssuerId.length > 0 && trimmedIosKeyId.length > 0;
  const isIosCredentialPairValid = !showAppleSection || iosCredentialsProvided;
  const androidSectionHasChanges =
    showAndroidSection &&
    trimmedAndroidPackageName !== originalAndroidPackageName;
  const iosSectionHasChanges =
    showAppleSection &&
    (trimmedIosBundleId !== originalIosBundleId ||
      trimmedIosAppleId !== originalIosAppleIdString ||
      trimmedIosIssuerId !== originalIosIssuerId ||
      trimmedIosKeyId !== originalIosKeyId);
  const showIosP8Requirement = showAppleSection && !isIosP8Provided;
  const metadataHasChanges = androidSectionHasChanges || iosSectionHasChanges;
  const disableSaveMetadata =
    !metadataHasChanges ||
    !isAndroidPackageValid ||
    !isIosBundleValid ||
    !isIosAppleIdValid ||
    !isIosIssuerIdValid ||
    !isIosKeyIdValid ||
    !isIosCredentialPairValid ||
    savingMetadata;

  // Horizon (inside the Android card) has its own save flow rather
  // than piggybacking on the identifiers form above — the form lives
  // in a different card and lumping horizon into it would produce a
  // confusing "why did this Save button clear my credential?" UX when
  // the user just toggled the checkbox off. `savingHorizon` is
  // declared at the top of the component with the other hooks so it
  // lives above the early-return guard (rules-of-hooks).
  const horizonAppIdValid =
    !horizonEnabled || /^\d{6,20}$/.test(trimmedHorizonAppId);
  // The secret input is only required when enabling Horizon from a
  // blank slate or when the user explicitly chose to replace it.
  // Otherwise an empty field means "leave the existing secret alone"
  // — the server redacts it so we never had the original to compare.
  const horizonAppSecretNeeded =
    horizonEnabled &&
    (!hasHorizonAppSecretConfigured || isReplacingHorizonAppSecret);
  const horizonAppSecretValid =
    !horizonAppSecretNeeded ||
    (trimmedHorizonAppSecret.length >= 16 &&
      trimmedHorizonAppSecret.length <= 2_048);
  const horizonHasChanges =
    horizonEnabled !== originalHorizonEnabled ||
    (horizonEnabled &&
      (trimmedHorizonAppId !== originalHorizonAppId ||
        (horizonAppSecretNeeded && trimmedHorizonAppSecret.length > 0)));
  const disableSaveHorizon =
    !horizonHasChanges ||
    !horizonAppIdValid ||
    !horizonAppSecretValid ||
    savingHorizon;

  const handleMetadataSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!project || disableSaveMetadata) {
      return;
    }

    setSavingMetadata(true);
    try {
      const payload: {
        projectId: Id<"projects">;
        androidPackageName?: string;
        iosBundleId?: string;
        iosAppAppleId?: number;
        iosAppStoreIssuerId?: string;
        iosAppStoreKeyId?: string;
      } = {
        projectId: project._id,
      };

      if (showAndroidSection) {
        payload.androidPackageName = trimmedAndroidPackageName;
      }

      if (showAppleSection) {
        payload.iosBundleId = trimmedIosBundleId;
        if (trimmedIosAppleId) {
          payload.iosAppAppleId = Number(trimmedIosAppleId);
        }
        if (trimmedIosIssuerId) {
          payload.iosAppStoreIssuerId = trimmedIosIssuerId;
        }
        if (trimmedIosKeyId) {
          payload.iosAppStoreKeyId = trimmedIosKeyId;
        }
      }

      await updateProject(payload);

      toast.success("Identifiers updated successfully");
    } catch (error: any) {
      console.error("Project metadata update error:", error);
      toast.error(error.message || "Failed to update identifiers");
    } finally {
      setSavingMetadata(false);
    }
  };

  const handleHorizonSubmit = async () => {
    if (!project || disableSaveHorizon) {
      return;
    }

    setSavingHorizon(true);
    try {
      // When disabling, skip the credential fields entirely — the
      // mutation clears them server-side once horizonEnabled flips to
      // false, so sending empty strings here would just trip the
      // non-empty validator.
      const payload: {
        projectId: Id<"projects">;
        horizonEnabled: boolean;
        horizonAppId?: string;
        horizonAppSecret?: string;
      } = {
        projectId: project._id,
        horizonEnabled,
      };

      if (horizonEnabled) {
        payload.horizonAppId = trimmedHorizonAppId;
        // Include the secret whenever it's expected on the wire —
        // either first-time setup (no secret configured yet) or the
        // user clicked Replace. Existing-secret path (not replacing)
        // omits the field so the mutation leaves the stored secret
        // alone (the query redacts it, so we never had it to
        // round-trip anyway). Missing this on first-time setup used
        // to trip the server's "Enabling Meta Horizon requires a
        // Horizon App Secret" invariant.
        if (horizonAppSecretNeeded && trimmedHorizonAppSecret) {
          payload.horizonAppSecret = trimmedHorizonAppSecret;
        }
      }

      await updateProject(payload);

      toast.success("Horizon configuration saved.");
    } catch (error: any) {
      console.error("Horizon config update error:", error);
      toast.error(error.message || "Failed to save Horizon configuration.");
    } finally {
      setSavingHorizon(false);
    }
  };

  const handleIosFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith(".p8")) {
      toast.error("Please upload a valid .p8 file");
      return;
    }

    setUploadingIos(true);
    try {
      // Step 1: Generate upload URL
      const postUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      // Step 3: Save file record to database
      await saveFile({
        organizationId: project.organizationId,
        projectId: project._id,
        storageId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        purpose: "apple_p8_key",
        description: `Apple .p8 key for ${project.name}`,
        isInternal: true,
      });

      setIosFileUploaded(true);
      toast.success("iOS authentication file uploaded successfully");
    } catch (error: any) {
      console.error("iOS file upload error:", error);
      toast.error(error.message || "Failed to upload iOS authentication file");
    } finally {
      setUploadingIos(false);
    }
  };

  const handleAndroidFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith(".json")) {
      toast.error("Please upload a valid JSON file");
      return;
    }

    setUploadingAndroid(true);
    try {
      // Step 1: Generate upload URL
      const postUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/json" },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      // Step 3: Save file record to database
      await saveFile({
        organizationId: project.organizationId,
        projectId: project._id,
        storageId,
        fileName: file.name,
        fileType: file.type || "application/json",
        fileSize: file.size,
        purpose: "android_service_account",
        description: `Android service account for ${project.name}`,
        isInternal: true,
      });

      setAndroidFileUploaded(true);
      toast.success("Android service account uploaded successfully");
    } catch (error: any) {
      console.error("Android file upload error:", error);
      toast.error(error.message || "Failed to upload Android service account");
    } finally {
      setUploadingAndroid(false);
    }
  };

  const handleIosFileDelete = async () => {
    if (!iosFile?._id) return;

    try {
      await removeFile({ fileId: iosFile._id });
      setIosFileUploaded(false);
      toast.success("iOS authentication file deleted successfully");
    } catch (error: any) {
      console.error("iOS file delete error:", error);
      toast.error(error.message || "Failed to delete iOS authentication file");
    }
  };

  const handleAndroidFileDelete = async () => {
    if (!androidFile?._id) return;

    try {
      await removeFile({ fileId: androidFile._id });
      setAndroidFileUploaded(false);
      toast.success("Android service account deleted successfully");
    } catch (error: any) {
      console.error("Android file delete error:", error);
      toast.error(error.message || "Failed to delete Android service account");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">{"Project Settings"}</h2>

      {/* Project ID display */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Project ID:{" "}
          <span className="font-mono text-foreground">{project._id}</span>
        </p>
      </div>

      {/* App identifiers form */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="mb-4">
          <h3 className="font-semibold text-lg">{"App identifiers"}</h3>
          <p className="text-sm text-muted-foreground">
            {
              "Store the identifiers required for App Store and Google Play purchase verification."
            }
          </p>
        </div>
        <div className="mb-6 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-medium">{"Supported platforms"}</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <label
              className={`flex flex-1 items-start gap-2 rounded-md border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary ${
                applePlatformsLocked
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
              aria-disabled={applePlatformsLocked}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={showAppleSection}
                onChange={(event) => {
                  if (applePlatformsLocked) {
                    return;
                  }
                  setApplePlatformsSelected(event.target.checked);
                }}
                disabled={applePlatformsLocked}
              />
              <span className="text-sm font-medium">
                {"iOS, macOS, tvOS, iPadOS"}
              </span>
            </label>
            <label
              className={`flex flex-1 items-start gap-2 rounded-md border border-border bg-background px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary ${
                androidPlatformsLocked
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              }`}
              aria-disabled={androidPlatformsLocked}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={showAndroidSection}
                onChange={(event) => {
                  if (androidPlatformsLocked) {
                    return;
                  }
                  setAndroidPlatformsSelected(event.target.checked);
                }}
                disabled={androidPlatformsLocked}
              />
              <span className="text-sm font-medium">{"Android"}</span>
            </label>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleMetadataSubmit(event);
          }}
        >
          {showAndroidSection && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {"Android package name"}{" "}
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">{"Required"}</span>
              </label>
              <input
                type="text"
                value={androidPackageName}
                onChange={(event) => setAndroidPackageName(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                placeholder="com.example.app"
                spellCheck={false}
                aria-invalid={!isAndroidPackageValid}
                disabled={androidPackageLocked}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {
                  "Use the exact package name from the Google Play Console (e.g., com.example.app)."
                }
              </p>
              {androidPackageLocked && (
                <p className="text-xs text-muted-foreground mt-1">
                  {"Android package names can’t be edited once saved."}
                </p>
              )}
              {!isAndroidPackageValid && (
                <p className="text-xs text-destructive mt-1">
                  {"Enter a valid Android package name."}
                </p>
              )}
            </div>
          )}
          {showAppleSection && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {"App Store bundle ID"}{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">{"Required"}</span>
                </label>
                <input
                  type="text"
                  value={iosBundleId}
                  onChange={(event) => setIosBundleId(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                  placeholder="com.example.ios"
                  spellCheck={false}
                  aria-invalid={!isIosBundleValid}
                  disabled={iosBundleLocked}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {
                    "Use the bundle identifier from Xcode / App Store Connect (e.g., com.example.ios)."
                  }
                </p>
                {iosBundleLocked && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {"Bundle IDs can’t be edited once saved."}
                  </p>
                )}
                {!isIosBundleValid && (
                  <p className="text-xs text-destructive mt-1">
                    {"Enter a valid App Store bundle ID."}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {"App Apple ID"}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  value={iosAppAppleId}
                  onChange={(event) => setIosAppAppleId(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                  placeholder="1234567890"
                  aria-invalid={!isIosAppleIdValid}
                  disabled={iosAppleIdLocked}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {
                    "Required for production validations. This is the numeric Apple ID found in App Store Connect under Apps → <Your App> → App Information -> Apple ID."
                  }
                </p>
                {iosAppleIdLocked && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {"Apple App IDs can’t be edited once saved."}
                  </p>
                )}
                {!isIosAppleIdValid && (
                  <p className="text-xs text-destructive mt-1">
                    {"App Apple ID must be numeric."}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {"App Store Connect Issuer ID"}{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">{"Required"}</span>
                </label>
                <input
                  type="text"
                  value={iosAppStoreIssuerId}
                  onChange={(event) =>
                    setIosAppStoreIssuerId(event.target.value)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                  placeholder="12345678-ABCD-1234-ABCD-1234567890AB"
                  spellCheck={false}
                  aria-invalid={!isIosIssuerIdValid}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {
                    "Needed for App Store Server API calls. Find it in App Store Connect → Users and Access → Integrations → In-App Purchase (under Keys)"
                  }
                </p>
                {iosIssuerLocked && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {"Issuer IDs can’t be cleared once saved."}
                  </p>
                )}
                {!isIosIssuerIdValid && (
                  <p className="text-xs text-destructive mt-1">
                    {
                      "Issuer ID must match the UUID format (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)."
                    }
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {"App Store Connect Key ID"}{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">{"Required"}</span>
                </label>
                <input
                  type="text"
                  value={iosAppStoreKeyId}
                  onChange={(event) =>
                    setIosAppStoreKeyId(event.target.value.toUpperCase())
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                  placeholder="ABCDE12345"
                  spellCheck={false}
                  aria-invalid={!isIosKeyIdValid}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {
                    "Ten-character identifier shown next to the .p8 key. Find it in App Store Connect → Users and Access → Integrations → In-App Purchase (under Keys)"
                  }
                </p>
                {iosKeyLocked && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {"Key IDs can’t be cleared once saved."}
                  </p>
                )}
                {!isIosKeyIdValid && (
                  <p className="text-xs text-destructive mt-1">
                    {"Key ID must be 10 uppercase letters or numbers."}
                  </p>
                )}
                {!isIosCredentialPairValid && (
                  <p className="text-xs text-destructive mt-1">
                    {
                      "Provide both Issuer ID and Key ID to enable the App Store Server API."
                    }
                  </p>
                )}
              </div>
            </>
          )}
          <div className="flex flex-col gap-3 pt-4 border-t border-border/60 mt-6 md:flex-row md:items-center md:justify-between">
            <ButtonPrimary
              type="submit"
              disabled={disableSaveMetadata}
              loading={savingMetadata}
              size="sm"
            >
              {"Save identifiers"}
            </ButtonPrimary>
          </div>
        </form>
      </div>

      {/* Guide message if Android file is not uploaded */}
      {showAndroidSection && !androidFileUploaded && !hasAndroidFile && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                {"Configuration Required"}
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {
                  "Upload the Android service account JSON and the Apple App Store Connect .p8 key with Issuer ID and Key ID to enable purchase verification."
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {(showAppleSection || showAndroidSection) && (
        <div className={`grid gap-6 ${configurationGridColumns}`}>
          {/* iOS Configuration */}
          {showAppleSection && (
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Apple className="w-5 h-5" />
                <h3 className="font-semibold text-lg">{"iOS Configuration"}</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {"App Store Connect API Key (.p8)"}{" "}
                    <span className="text-destructive" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">{"Required"}</span>
                  </label>

                  {iosFileUploaded || hasIosFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
                          <div>
                            <span className="text-sm text-green-700 dark:text-green-400">
                              {"Authentication file uploaded successfully"}
                            </span>
                            {iosFile && (
                              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                {iosFile.fileName} •{" "}
                                {(iosFile.fileSize / 1024).toFixed(2)} KB
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => void handleIosFileDelete()}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                          title={"Delete file"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".p8"
                          onChange={(e) => void handleIosFileUpload(e)}
                          className="hidden"
                          id="ios-file-upload"
                          disabled={uploadingIos}
                        />
                        <label
                          htmlFor="ios-file-upload"
                          className={`flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                            uploadingIos
                              ? "border-muted bg-muted/20 cursor-not-allowed"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <Upload className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {uploadingIos
                              ? "Uploading..."
                              : "Click to upload .p8 file"}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {
                          "Required for App Store receipt verification. Generate the .p8 key in App Store Connect and upload it here."
                        }
                      </p>
                      {showIosP8Requirement && (
                        <p className="text-xs text-destructive mt-1">
                          {
                            "Upload your App Store Connect .p8 key to finish iOS setup."
                          }
                        </p>
                      )}

                      {/* P8 requirement reminder / advanced context */}
                      {showIosP8Requirement ? (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                                {"App Store Connect key missing"}
                              </p>
                              <p className="text-xs text-amber-800 dark:text-amber-200">
                                {
                                  "You must upload the downloaded .p8 key before IAPKit can verify App Store receipts."
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                                {
                                  "When P8 key is provided, these advanced features become available:"
                                }
                              </p>
                              <ul className="text-xs text-blue-700 dark:text-blue-400 ml-3 space-y-0.5">
                                <li>• {"Subscription Status Query"}</li>
                                <li>
                                  •{" "}
                                  {
                                    "Subscription Renewal/Cancellation Prediction"
                                  }
                                </li>
                                <li>• {"Refund History Query"}</li>
                                <li>
                                  •{" "}
                                  {
                                    "Consumption API (consumable item usage tracking)"
                                  }
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* iOS Setup Guide */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {"How to get your .p8 file:"}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowIosGuide(true)}
                      className="p-1 hover:bg-muted rounded-lg transition-colors"
                      title={"View Guide"}
                    >
                      <HelpCircle className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>
                      {
                        "Go to App Store Connect → Users and Access → Integrations → In-App Purchase"
                      }
                    </li>
                    <li>
                      {"Click 'Generate In-App Purchase Key' or '+' button"}
                    </li>
                    <li>
                      {
                        "Enter a name and download the .p8 file (can only be downloaded once)"
                      }
                    </li>
                  </ol>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setShowIosGuide(true)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {"View Screenshots"}
                      <HelpCircle className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-muted-foreground">•</span>
                    <a
                      href="https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {"Learn more"}
                      <FileText className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Configuration */}
          {showAndroidSection && (
            <div className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5" />
                <h3 className="font-semibold text-lg">
                  {"Android Configuration"}
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {"Google Service Account (JSON)"}
                  </label>

                  {androidFileUploaded || hasAndroidFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
                          <div>
                            <span className="text-sm text-green-700 dark:text-green-400">
                              {"Service account file uploaded successfully"}
                            </span>
                            {androidFile && (
                              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                                {androidFile.fileName} •{" "}
                                {(androidFile.fileSize / 1024).toFixed(2)} KB
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => void handleAndroidFileDelete()}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                          title={"Delete file"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => void handleAndroidFileUpload(e)}
                          className="hidden"
                          id="android-file-upload"
                          disabled={uploadingAndroid}
                        />
                        <label
                          htmlFor="android-file-upload"
                          className={`flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                            uploadingAndroid
                              ? "border-muted bg-muted/20 cursor-not-allowed"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          <Upload className="w-5 h-5" />
                          <span className="text-sm font-medium">
                            {uploadingAndroid
                              ? "Uploading..."
                              : "Click to upload JSON file"}
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {
                          "Required for validating Google Play purchases. Use minimum permissions principle."
                        }
                      </p>
                    </>
                  )}
                </div>

                {/* Android Setup Guide */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {"Setup Guide:"}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowAndroidGuide(true)}
                      className="p-1 hover:bg-muted rounded-lg transition-colors"
                      title={"View Guide"}
                    >
                      <HelpCircle className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>
                      {"In the Google Cloud Console go to Service Accounts"}
                    </li>
                    <li>
                      {"Click Create service account and follow the steps"}
                    </li>
                    <li>
                      {
                        "Go to the Users & Permissions page on the Google Play Console"
                      }
                    </li>
                    <li>{"Click Invite new users"}</li>
                    <li>
                      {
                        "Put an email address for your service account in the email address field and grant the necessary rights:"
                      }
                      <div className="ml-4 mt-1 space-y-0.5">
                        <div>
                          {
                            "• View financial data, orders, and cancellation survey responses"
                          }
                        </div>
                        <div>{"• Manage orders and subscriptions"}</div>
                      </div>
                    </li>
                    <li>{"Click Invite user"}</li>
                  </ol>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setShowAndroidGuide(true)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {"View Screenshots"}
                      <HelpCircle className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-muted-foreground">•</span>
                    <a
                      href="https://developers.google.com/android-publisher/getting_started#using_a_service_account"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {"Learn more"}
                      <FileText className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Meta Horizon subsection — same card as Android because
                    the client SDK is Google-Play-Billing-compatible, but
                    verification goes through Meta's Graph API with its
                    own App ID + Access Token pair. Gated by a checkbox
                    so Android-only projects aren't cluttered. */}
                <div className="pt-4 border-t">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      checked={horizonEnabled}
                      onChange={(e) => setHorizonEnabled(e.target.checked)}
                    />
                    <span className="flex-1">
                      <span className="text-sm font-medium block">
                        {"Enable Meta Horizon (Quest / VR)"}
                      </span>
                      <span className="text-xs text-muted-foreground block mt-1 break-words">
                        {
                          "Meta's billing SDK is Google-Play-compatible, but server verification goes through the Meta Graph API with its own credentials."
                        }
                      </span>
                    </span>
                  </label>

                  {horizonEnabled && (
                    <div className="mt-4 space-y-4 pl-7">
                      <div>
                        <label
                          htmlFor="horizon-app-id"
                          className="block text-sm font-medium mb-2"
                        >
                          {"Meta App ID"}
                        </label>
                        <input
                          id="horizon-app-id"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="123456789012345"
                          value={horizonAppId}
                          onChange={(e) => setHorizonAppId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {
                            "Numeric ID from the Meta Developer Dashboard (6–20 digits)."
                          }
                        </p>
                        {!horizonAppIdValid &&
                          trimmedHorizonAppId.length > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              {"App ID must be a numeric string (6–20 digits)."}
                            </p>
                          )}
                      </div>

                      <div>
                        <label
                          htmlFor="horizon-app-secret"
                          className="block text-sm font-medium mb-2"
                        >
                          {"App Secret"}
                        </label>
                        {hasHorizonAppSecretConfigured &&
                        !isReplacingHorizonAppSecret ? (
                          // Secret already on file. Server never echoes
                          // it back, so instead of rendering an empty
                          // password input (which would imply "clear"
                          // semantics) show a "configured" affordance
                          // with a Replace button.
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
                              <span className="text-sm text-green-700 dark:text-green-400">
                                {"App Secret configured"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsReplacingHorizonAppSecret(true);
                                setHorizonAppSecret("");
                              }}
                              className="px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                            >
                              {"Replace"}
                            </button>
                          </div>
                        ) : (
                          <input
                            id="horizon-app-secret"
                            type="password"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="••••••••••••••••••••••••••••••••"
                            value={horizonAppSecret}
                            onChange={(e) =>
                              setHorizonAppSecret(e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        )}
                        <p className="text-xs text-muted-foreground mt-1 break-words">
                          {
                            "App Secret from the Meta Developer Dashboard. The IAPKit server combines it with the App ID as OC|APP_ID|APP_SECRET for each verify call — treat it like a password."
                          }
                        </p>
                        {!horizonAppSecretValid &&
                          trimmedHorizonAppSecret.length > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              {
                                "App Secret looks malformed (expected 16–2048 characters)."
                              }
                            </p>
                          )}
                      </div>

                      <a
                        href="https://developers.meta.com/horizon/resources/publish-iap-overview/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {"Meta billing docs"}
                        <FileText className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleHorizonSubmit()}
                      disabled={disableSaveHorizon}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingHorizon
                        ? "Saving…"
                        : horizonEnabled
                          ? "Save Horizon config"
                          : "Disable Horizon"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guide Modal for iOS */}
      <GuideModal
        isOpen={showIosGuide}
        onClose={() => setShowIosGuide(false)}
        title={"How to get your .p8 file:"}
        images={[
          {
            src: "/guides/[IOS] 1. In-App Purchase Key.png",
            alt: "In-App Purchase Key location",
            caption:
              "Go to App Store Connect → Users and Access → Integrations → In-App Purchase",
          },
          {
            src: "/guides/[IOS] 2. Download In-App Purchase Key.png",
            alt: "Download In-App Purchase Key",
            caption:
              "Click 'Generate In-App Purchase Key' or '+' button" +
              " & " +
              "Enter a name and download the .p8 file (can only be downloaded once)",
          },
        ]}
      />

      {/* Guide Modal for Android */}
      <GuideModal
        isOpen={showAndroidGuide}
        onClose={() => setShowAndroidGuide(false)}
        title={"Setup Guide:"}
        images={[
          {
            src: "/guides/[Android] 1. Create JSON Key.png",
            alt: "Create JSON Key",
            caption:
              "In the Google Cloud Console go to Service Accounts" +
              " & " +
              "Click Create service account and follow the steps",
          },
          {
            src: "/guides/[Android] 2. Add Permission when inviting service account.png",
            alt: "Add Permission when inviting service account",
            caption:
              "Go to the Users & Permissions page on the Google Play Console" +
              " - " +
              "Put an email address for your service account in the email address field and grant the necessary rights:",
          },
          {
            src: "/guides/[Android] 3. Invite Service Account.png",
            alt: "Invite Service Account",
            caption: "Click Invite user",
          },
        ]}
      />
    </div>
  );
}
