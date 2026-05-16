import { useEffect, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
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
  Download,
  CircleDollarSign,
} from "lucide-react";
import { GuideModal } from "../../../../components/GuideModal";
import { PageLoading } from "@/components/LoadingSpinner";
import { ButtonPrimary } from "@/components/ButtonPrimary";
import { DEFAULT_REPORTING_CURRENCY, currencyCodePattern } from "@/lib/utils";

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
  platform?: string;
  androidPackageName?: string;
  iosBundleId?: string;
  iosAppAppleId?: number;
  iosAppStoreIssuerId?: string;
  iosAppStoreKeyId?: string;
  iosAscKeyId?: string;
  reportingCurrency?: string;
  horizonEnabled?: boolean;
  horizonAppId?: string | null;
  // The Meta App Secret is never returned by
  // `api.projects.query.getProject` — the server omits it so a
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
  const [iosAscFileUploaded, setIosAscFileUploaded] = useState(false);
  const [androidFileUploaded, setAndroidFileUploaded] = useState(false);
  const [uploadingIos, setUploadingIos] = useState(false);
  const [uploadingIosAsc, setUploadingIosAsc] = useState(false);
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
  // App Store Connect API credentials — Issuer ID is shared with the
  // Server API one above (Apple uses one Issuer per team across both
  // tabs); only Key ID + .p8 differ. See `convex/schema.ts` and
  // `convex/products/asc.ts` (asc.ts falls back to
  // `iosAppStoreIssuerId` when `iosAscIssuerId` is unset).
  const [iosAscKeyId, setIosAscKeyId] = useState(project?.iosAscKeyId ?? "");
  const [reportingCurrency, setReportingCurrency] = useState(
    project?.reportingCurrency ?? DEFAULT_REPORTING_CURRENCY,
  );
  // Meta Horizon — gated by a checkbox inside the Android card.
  // The enabled flag is the single source of truth: toggling off
  // clears the credential fields on save so stale secrets can't
  // linger in the DB after the user deselected Horizon.
  const [horizonEnabled, setHorizonEnabled] = useState(
    Boolean(project?.horizonEnabled),
  );
  const [horizonAppId, setHorizonAppId] = useState(project?.horizonAppId ?? "");
  // Secret is ALWAYS empty on mount: the server omits it from the
  // query so we never receive it in the browser. `isReplacingHorizonAppSecret`
  // toggles between the "Configured ✓ / Replace" affordance and the
  // password input. Saving without replacing is a no-op for the
  // secret field — existing stays untouched.
  const [horizonAppSecret, setHorizonAppSecret] = useState("");
  const [isReplacingHorizonAppSecret, setIsReplacingHorizonAppSecret] =
    useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [savingReportingCurrency, setSavingReportingCurrency] = useState(false);
  const [savingHorizon, setSavingHorizon] = useState(false);

  // Convex mutations for file upload
  const generateUploadUrl = useMutation(api.files.mutation.generateUploadUrl);
  const saveFile = useMutation(api.files.mutation.saveFile);
  const removeFile = useMutation(api.files.mutation.remove);
  const downloadFile = useAction(api.files.action.downloadFile);

  // Download a previously-uploaded credential file. Useful when an
  // admin needs the original .p8 / service-account JSON back —
  // for rotating across projects, copying to a backup, or just
  // double-checking what kit holds matches the upstream console.
  const handleFileDownload = async (fileId: Id<"files">, label: string) => {
    try {
      const result = await downloadFile({ fileId });
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${label} download started`);
    } catch (error: any) {
      console.error(`${label} download error:`, error);
      toast.error(error?.message || `Failed to download ${label}`);
    }
  };
  const updateProject = useMutation(api.projects.mutation.updateProject);

  const originalAndroidPackageName = project?.androidPackageName ?? "";
  const originalIosBundleId = project?.iosBundleId ?? "";
  const originalIosAppleIdString =
    project?.iosAppAppleId !== undefined && project?.iosAppAppleId !== null
      ? String(project.iosAppAppleId)
      : "";
  const originalIosIssuerId = project?.iosAppStoreIssuerId ?? "";
  const originalIosKeyId = project?.iosAppStoreKeyId ?? "";
  const originalIosAscKeyId = project?.iosAscKeyId ?? "";
  const originalReportingCurrency =
    project?.reportingCurrency ?? DEFAULT_REPORTING_CURRENCY;
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
    setIosAscKeyId(originalIosAscKeyId);
    setReportingCurrency(originalReportingCurrency);
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
    originalIosAscKeyId,
    originalReportingCurrency,
    originalHorizonEnabled,
    originalHorizonAppId,
    hasHorizonAppSecretConfigured,
  ]);

  const trimmedAndroidPackageName = androidPackageName.trim();
  const trimmedIosBundleId = iosBundleId.trim();
  const trimmedIosAppleId = iosAppAppleId.trim();
  const trimmedIosIssuerId = iosAppStoreIssuerId.trim();
  const trimmedIosKeyId = iosAppStoreKeyId.trim().toUpperCase();
  const trimmedIosAscKeyId = iosAscKeyId.trim().toUpperCase();
  const trimmedReportingCurrency = reportingCurrency.trim().toUpperCase();
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
  const iosAscFile = files?.find(
    (file) =>
      file.purpose === "apple_p8_asc_api_key" &&
      file.projectId === project?._id,
  );
  const androidFile = files?.find(
    (file) =>
      file.purpose === "android_service_account" &&
      file.projectId === project?._id,
  );

  const hasIosFile = !!iosFile;
  const hasIosAscFile = !!iosAscFile;
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
  // ASC API Key ID — optional (only required for push-sync). The
  // matching Issuer ID is shared with the Server API one above.
  const isIosAscKeyIdValid =
    !showAppleSection ||
    trimmedIosAscKeyId.length === 0 ||
    appStoreKeyPattern.test(trimmedIosAscKeyId);
  const androidSectionHasChanges =
    showAndroidSection &&
    trimmedAndroidPackageName !== originalAndroidPackageName;
  const iosSectionHasChanges =
    showAppleSection &&
    (trimmedIosBundleId !== originalIosBundleId ||
      trimmedIosAppleId !== originalIosAppleIdString ||
      trimmedIosIssuerId !== originalIosIssuerId ||
      trimmedIosKeyId !== originalIosKeyId ||
      trimmedIosAscKeyId !== originalIosAscKeyId);
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
    !isIosAscKeyIdValid ||
    savingMetadata;
  const isReportingCurrencyValid = currencyCodePattern.test(
    trimmedReportingCurrency,
  );
  const reportingCurrencyErrorId = "reporting-currency-error";
  const reportingCurrencyHasChanges =
    trimmedReportingCurrency !== originalReportingCurrency;
  const disableSaveReportingCurrency =
    !reportingCurrencyHasChanges ||
    !isReportingCurrencyValid ||
    savingReportingCurrency;

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
  // — the server omits it so we never had the original to compare.
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
        iosAscKeyId?: string;
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
        if (trimmedIosAscKeyId) {
          payload.iosAscKeyId = trimmedIosAscKeyId;
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
        // alone (the query omits it, so we never had it to
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

  const handleReportingCurrencySubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!project || disableSaveReportingCurrency) {
      return;
    }

    setSavingReportingCurrency(true);
    try {
      await updateProject({
        projectId: project._id,
        reportingCurrency: trimmedReportingCurrency,
      });
      toast.success("Reporting currency saved.");
    } catch (error: any) {
      console.error("Reporting currency update error:", error);
      toast.error(error.message || "Failed to save reporting currency.");
    } finally {
      setSavingReportingCurrency(false);
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

  const handleIosAscFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".p8")) {
      toast.error("Please upload a valid .p8 file");
      return;
    }
    setUploadingIosAsc(true);
    try {
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed");
      const { storageId } = await result.json();
      await saveFile({
        organizationId: project.organizationId,
        projectId: project._id,
        storageId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        purpose: "apple_p8_asc_api_key",
        description: `App Store Connect API key for ${project.name}`,
        isInternal: true,
      });
      setIosAscFileUploaded(true);
      toast.success("App Store Connect API key uploaded successfully");
    } catch (error: any) {
      console.error("iOS ASC file upload error:", error);
      toast.error(error.message || "Failed to upload App Store Connect key");
    } finally {
      setUploadingIosAsc(false);
    }
  };

  const handleIosAscFileDelete = async () => {
    if (!iosAscFile?._id) return;
    try {
      await removeFile({ fileId: iosAscFile._id });
      setIosAscFileUploaded(false);
      toast.success("App Store Connect API key deleted successfully");
    } catch (error: any) {
      console.error("iOS ASC file delete error:", error);
      toast.error(error.message || "Failed to delete App Store Connect key");
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

      <form
        onSubmit={(event) => {
          void handleReportingCurrencySubmit(event);
        }}
        className="bg-card rounded-lg border border-border p-6 mb-6"
      >
        <div className="flex items-center gap-2 mb-2">
          <CircleDollarSign className="w-5 h-5" />
          <h3 className="font-semibold text-lg">Reporting currency</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Main MRR and revenue totals only include rows already stored in this
          currency. IAPKit keeps other currencies visible separately and does
          not convert them.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:w-40">
            <label className="block text-sm font-medium mb-2">
              Currency code
            </label>
            <input
              type="text"
              value={reportingCurrency}
              onChange={(event) =>
                setReportingCurrency(event.target.value.toUpperCase())
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase tracking-normal focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="USD"
              maxLength={3}
              spellCheck={false}
              aria-invalid={!isReportingCurrencyValid}
              aria-describedby={
                !isReportingCurrencyValid ? reportingCurrencyErrorId : undefined
              }
            />
            {!isReportingCurrencyValid && (
              <p
                id={reportingCurrencyErrorId}
                className="text-sm text-destructive mt-1"
              >
                Enter a 3-letter ISO 4217 code.
              </p>
            )}
          </div>
          <div className="flex-1 sm:pt-7">
            <ButtonPrimary
              type="submit"
              size="sm"
              disabled={disableSaveReportingCurrency}
            >
              {savingReportingCurrency ? "Saving..." : "Save currency"}
            </ButtonPrimary>
          </div>
        </div>
      </form>

      {/* Supported platforms — gates which configuration cards render
          below. Identifiers + credentials live INSIDE each platform's
          card so the iOS/Android boundary is unambiguous: everything
          related to one store stays in one place. */}
      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <h3 className="font-semibold text-lg mb-1">{"Supported platforms"}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {
            "Pick the stores you want kit to validate. Each platform's identifiers, credentials, and setup guide live in the matching card below."
          }
        </p>
        <div className="flex flex-col gap-3 md:flex-row">
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

      {/* Configuration Required banner — fires whenever any
          *enabled* platform is missing its credential file. iOS-only
          projects need the .p8; Android-only projects need the JSON;
          dual-platform projects need both. The message is composed
          from whichever platforms are missing so we don't tell an
          iOS-only operator they need to upload an Android file. */}
      {(() => {
        const missingIos = showAppleSection && !iosFileUploaded && !hasIosFile;
        const missingAndroid =
          showAndroidSection && !androidFileUploaded && !hasAndroidFile;
        if (!missingIos && !missingAndroid) return null;
        const parts: string[] = [];
        if (missingIos) {
          parts.push(
            "the Apple App Store Connect .p8 key with Issuer ID and Key ID",
          );
        }
        if (missingAndroid) {
          parts.push("the Android service account JSON");
        }
        const message = `Upload ${parts.join(" and ")} to enable purchase verification.`;
        return (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  {"Configuration Required"}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {message}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {(showAppleSection || showAndroidSection) && (
        <form
          onSubmit={(event) => {
            void handleMetadataSubmit(event);
          }}
        >
          <div className={`grid gap-6 ${configurationGridColumns}`}>
            {/* iOS Configuration — bundle ID + Apple ID + ASC Issuer/Key
                + .p8 file all live here so iOS-only configuration is
                self-contained. */}
            {showAppleSection && (
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Apple className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">
                    {"iOS Configuration"}
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* iOS identifiers (App Store bundle ID + Apple ID +
                      ASC Issuer/Key) — submitted via this card's parent
                      form. The .p8 file upload below is a separate flow
                      (file uploads don't go through form submit). */}
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {
                        "Use the bundle identifier from Xcode / App Store Connect (e.g., com.example.ios)."
                      }
                    </p>
                    {iosBundleLocked && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {"Bundle IDs can’t be edited once saved."}
                      </p>
                    )}
                    {!isIosBundleValid && (
                      <p className="text-sm text-destructive mt-1">
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {
                        "Required for production validations. This is the numeric Apple ID found in App Store Connect under Apps → <Your App> → App Information -> Apple ID."
                      }
                    </p>
                    {iosAppleIdLocked && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {"Apple App IDs can’t be edited once saved."}
                      </p>
                    )}
                    {!isIosAppleIdValid && (
                      <p className="text-sm text-destructive mt-1">
                        {"App Apple ID must be numeric."}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {"Server API Issuer ID"}{" "}
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {
                        "App Store Server API issuer. Find it in App Store Connect → Users and Access → Integrations → In-App Purchase (under Keys)."
                      }
                    </p>
                    {iosIssuerLocked && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {"Issuer IDs can’t be cleared once saved."}
                      </p>
                    )}
                    {!isIosIssuerIdValid && (
                      <p className="text-sm text-destructive mt-1">
                        {
                          "Issuer ID must match the UUID format (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)."
                        }
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {"Server API Key ID"}{" "}
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
                    <p className="text-sm text-muted-foreground mt-1">
                      {
                        "Ten-character identifier shown next to the In-App Purchase .p8 key in App Store Connect."
                      }
                    </p>
                    {iosKeyLocked && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {"Key IDs can’t be cleared once saved."}
                      </p>
                    )}
                    {!isIosKeyIdValid && (
                      <p className="text-sm text-destructive mt-1">
                        {"Key ID must be 10 uppercase letters or numbers."}
                      </p>
                    )}
                    {!isIosCredentialPairValid && (
                      <p className="text-sm text-destructive mt-1">
                        {
                          "Provide both Issuer ID and Key ID to enable the App Store Server API."
                        }
                      </p>
                    )}
                  </div>

                  {/* ── 1. App Store Server API Key (.p8) ─────────────
                      The In-App Purchase key. Used by kit's receipt
                      verifier (purchases/ios.ts) for the App Store
                      Server API gateway. Required for receipt
                      verification, subscription status, refund
                      history. */}
                  <div className="pt-4 border-t border-border/60">
                    <label className="block text-sm font-medium mb-2">
                      {"App Store Server API Key (.p8)"}{" "}
                      <span className="text-destructive" aria-hidden="true">
                        *
                      </span>
                      <span className="sr-only">{"Required"}</span>
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {
                        "Used by kit to talk to Apple's App Store Server API: receipt verification on initial purchase, subscription status queries, transaction lookup, refund history. Generate at App Store Connect → Users and Access → Integrations → In-App Purchase."
                      }
                    </p>

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
                                <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                                  {iosFile.fileName} •{" "}
                                  {(iosFile.fileSize / 1024).toFixed(2)} KB
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {iosFile && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleFileDownload(
                                    iosFile._id,
                                    "App Store Server API key",
                                  )
                                }
                                className="p-2 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title={"Download file"}
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleIosFileDelete()}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title={"Delete file"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                        <p className="text-sm text-muted-foreground mt-2">
                          {
                            "Required for App Store receipt verification. Generate the .p8 key in App Store Connect and upload it here."
                          }
                        </p>
                        {showIosP8Requirement && (
                          <p className="text-sm text-destructive mt-1">
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
                                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                                  {"App Store Connect key missing"}
                                </p>
                                <p className="text-sm text-amber-800 dark:text-amber-200">
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
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                  {
                                    "When P8 key is provided, these advanced features become available:"
                                  }
                                </p>
                                <ul className="text-sm text-blue-700 dark:text-blue-400 ml-3 space-y-0.5">
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

                    {/* Inline setup guide — sits with the Server API
                        .p8 upload so the operator doesn't have to
                        scroll to a separate "How to" block to remember
                        which Apple page to open. Hidden once the .p8
                        is uploaded; instructions become noise once
                        the slot is filled. */}
                    {!iosFileUploaded && !hasIosFile && (
                      <div className="mt-4 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {"How to get your Server API .p8 file:"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowIosGuide(true)}
                            className="p-1 hover:bg-muted rounded-lg transition-colors"
                            title={"View Guide"}
                          >
                            <HelpCircle className="w-4 h-4 text-primary" />
                          </button>
                        </div>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>
                            {
                              "Go to App Store Connect → Users and Access → Integrations → In-App Purchase"
                            }
                          </li>
                          <li>
                            {
                              "Click 'Generate In-App Purchase Key' or '+' button"
                            }
                          </li>
                          <li>
                            {
                              "Enter a name and download the .p8 file (can only be downloaded once)"
                            }
                          </li>
                          <li>
                            {
                              "Copy the Issuer ID at the top of the page and the Key ID next to your new key"
                            }
                          </li>
                        </ol>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setShowIosGuide(true)}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {"View Screenshots"}
                            <HelpCircle className="w-3 h-3" />
                          </button>
                          <span className="text-sm text-muted-foreground">
                            •
                          </span>
                          <a
                            href="https://developer.apple.com/documentation/appstoreserverapi/creating_api_keys_to_use_with_the_app_store_server_api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {"Apple docs"}
                            <FileText className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 2. App Store Connect API Key (.p8) ──────────
                      Genuinely a different key from the Server API one
                      above. Used by kit's catalog sync (products/asc.ts)
                      against the App Store Connect API gateway. Apple
                      scopes the two gateways separately — a key
                      generated under "In-App Purchase" returns 401 for
                      Connect endpoints, and vice versa. Optional. */}
                  <div className="pt-4 border-t border-border/60">
                    <label className="block text-sm font-medium mb-2">
                      {"App Store Connect API Key (.p8)"}
                    </label>
                    <p className="text-sm text-muted-foreground mb-3">
                      {
                        "A second .p8 — different from the Server API key above. Apple scopes its two API gateways separately: the In-App Purchase key only authenticates receipt-verification endpoints, while catalog management (list / create / update IAPs) lives on the App Store Connect API gateway and rejects the Server API key with 401. Optional — only needed if you want kit to push-sync your IAP catalog from the dashboard. Generate at App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys (or Individual Keys)."
                      }
                    </p>

                    <p className="text-sm text-muted-foreground mb-3">
                      {
                        "Issuer ID is shared with the Server API above (Apple uses one Issuer per team across both pages); only the Key ID + .p8 file differ between the two."
                      }
                    </p>

                    <label className="block text-sm font-medium mb-2">
                      {"Connect API Key ID"}
                    </label>
                    <input
                      type="text"
                      value={iosAscKeyId}
                      onChange={(event) =>
                        setIosAscKeyId(event.target.value.toUpperCase())
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                      placeholder="ABCDE12345"
                      spellCheck={false}
                      aria-invalid={!isIosAscKeyIdValid}
                    />
                    {!isIosAscKeyIdValid && (
                      <p className="text-sm text-destructive mt-1">
                        {"Key ID must be 10 uppercase letters or numbers."}
                      </p>
                    )}

                    <div className="mt-4">
                      {iosAscFileUploaded || hasIosAscFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500" />
                              <div>
                                <span className="text-sm text-green-700 dark:text-green-400">
                                  {"Connect API key uploaded successfully"}
                                </span>
                                {iosAscFile && (
                                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                                    {iosAscFile.fileName} •{" "}
                                    {(iosAscFile.fileSize / 1024).toFixed(2)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {iosAscFile && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleFileDownload(
                                      iosAscFile._id,
                                      "Connect API key",
                                    )
                                  }
                                  className="p-2 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                  title={"Download file"}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleIosAscFileDelete()}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                title={"Delete file"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type="file"
                              accept=".p8"
                              onChange={(e) => void handleIosAscFileUpload(e)}
                              className="hidden"
                              id="ios-asc-file-upload"
                              disabled={uploadingIosAsc}
                            />
                            <label
                              htmlFor="ios-asc-file-upload"
                              className={`flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                                uploadingIosAsc
                                  ? "border-muted bg-muted/20 cursor-not-allowed"
                                  : "border-border hover:border-primary hover:bg-primary/5"
                              }`}
                            >
                              <Upload className="w-5 h-5" />
                              <span className="text-sm font-medium">
                                {uploadingIosAsc
                                  ? "Uploading..."
                                  : "Click to upload Connect API .p8 file"}
                              </span>
                            </label>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {
                              "Upload only after you've generated the Team Key (or Individual Key) under App Store Connect API — uploading the In-App Purchase key here will result in 401 errors during sync."
                            }
                          </p>
                        </>
                      )}
                    </div>

                    {/* Inline setup guide — sits with the Connect API
                        .p8 upload so the operator sees the steps right
                        next to the slot that uses them. Hidden once
                        the .p8 is uploaded. */}
                    {!iosAscFileUploaded && !hasIosAscFile && (
                      <div className="mt-4 pt-4 border-t border-border/60">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {"How to get your Connect API .p8 file:"}
                          </span>
                        </div>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>
                            {
                              "Go to App Store Connect → Users and Access → Integrations → App Store Connect API"
                            }
                          </li>
                          <li>
                            {
                              "Pick the Team Keys tab (or Individual Keys for a personal key)"
                            }
                          </li>
                          <li>
                            {
                              "Click '+' / 'Generate API Key' and assign at least the 'App Manager' role so the key can list and modify in-app purchases"
                            }
                          </li>
                          <li>
                            {
                              "Download the .p8 file (can only be downloaded once)"
                            }
                          </li>
                          <li>
                            {
                              "Copy the Issuer ID at the top of the page and the Key ID next to your new key — these are different from the Server API ones"
                            }
                          </li>
                        </ol>
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href="https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {"Apple docs"}
                            <FileText className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Android Configuration — package name + service-account JSON
              + Horizon (Quest / VR) toggle all live here so Android-only
              configuration is self-contained. */}
            {showAndroidSection && (
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">
                    {"Android Configuration"}
                  </h3>
                </div>

                <div className="space-y-4">
                  {/* Android package name — submitted via the parent
                    form's metadata save. The JSON file upload below is
                    a separate flow. */}
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
                      onChange={(event) =>
                        setAndroidPackageName(event.target.value)
                      }
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-muted/40"
                      placeholder="com.example.app"
                      spellCheck={false}
                      aria-invalid={!isAndroidPackageValid}
                      disabled={androidPackageLocked}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {
                        "Use the exact package name from the Google Play Console (e.g., com.example.app)."
                      }
                    </p>
                    {androidPackageLocked && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {"Android package names can’t be edited once saved."}
                      </p>
                    )}
                    {!isAndroidPackageValid && (
                      <p className="text-sm text-destructive mt-1">
                        {"Enter a valid Android package name."}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border/60">
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
                                <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                                  {androidFile.fileName} •{" "}
                                  {(androidFile.fileSize / 1024).toFixed(2)} KB
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {androidFile && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleFileDownload(
                                    androidFile._id,
                                    "Service account JSON",
                                  )
                                }
                                className="p-2 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title={"Download file"}
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleAndroidFileDelete()}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title={"Delete file"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                        <p className="text-sm text-muted-foreground mt-2">
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
                        type="button"
                        onClick={() => setShowAndroidGuide(true)}
                        className="p-1 hover:bg-muted rounded-lg transition-colors"
                        title={"View Guide"}
                      >
                        <HelpCircle className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
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
                        type="button"
                        onClick={() => setShowAndroidGuide(true)}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {"View Screenshots"}
                        <HelpCircle className="w-3 h-3" />
                      </button>
                      <span className="text-sm text-muted-foreground">•</span>
                      <a
                        href="https://developers.google.com/android-publisher/getting_started#using_a_service_account"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
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
                        <span className="text-sm text-muted-foreground block mt-1 break-words">
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
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {
                              "Numeric ID from the Meta Developer Dashboard (6–20 digits)."
                            }
                          </p>
                          {!horizonAppIdValid &&
                            trimmedHorizonAppId.length > 0 && (
                              <p className="text-sm text-red-500 mt-1">
                                {
                                  "App ID must be a numeric string (6–20 digits)."
                                }
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
                                className="px-3 py-1 text-sm font-medium text-primary hover:bg-primary/10 rounded transition-colors"
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
                          <p className="text-sm text-muted-foreground mt-1 break-words">
                            {
                              "App Secret from the Meta Developer Dashboard. The IAPKit server combines it with the App ID as OC|APP_ID|APP_SECRET for each verify call — treat it like a password."
                            }
                          </p>
                          {!horizonAppSecretValid &&
                            trimmedHorizonAppSecret.length > 0 && (
                              <p className="text-sm text-red-500 mt-1">
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
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {"Meta billing docs"}
                          <FileText className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Save button only renders when there's actually
                     * something to save: either the user has Horizon
                     * checked (saving config), or they unchecked a
                     * previously-enabled toggle (persisting the
                     * disable). When the project never had Horizon and
                     * the toggle is off, the button is meaningless and
                     * hidden — the unchecked toggle alone is the
                     * "disabled" state, no extra click required. */}
                    {(horizonEnabled || originalHorizonEnabled) && (
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
                              : "Save changes"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

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
      )}

      {/* Guide Modal for iOS */}
      <GuideModal
        isOpen={showIosGuide}
        onClose={() => setShowIosGuide(false)}
        title={"How to get your .p8 file:"}
        images={[
          {
            src: "/guides/[IOS] 1. In-App Purchase Key.webp",
            alt: "In-App Purchase Key location",
            caption:
              "Go to App Store Connect → Users and Access → Integrations → In-App Purchase",
          },
          {
            src: "/guides/[IOS] 2. Download In-App Purchase Key.webp",
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
            src: "/guides/[Android] 1. Create JSON Key.webp",
            alt: "Create JSON Key",
            caption:
              "In the Google Cloud Console go to Service Accounts" +
              " & " +
              "Click Create service account and follow the steps",
          },
          {
            src: "/guides/[Android] 2. Add Permission when inviting service account.webp",
            alt: "Add Permission when inviting service account",
            caption:
              "Go to the Users & Permissions page on the Google Play Console" +
              " - " +
              "Put an email address for your service account in the email address field and grant the necessary rights:",
          },
          {
            src: "/guides/[Android] 3. Invite Service Account.webp",
            alt: "Invite Service Account",
            caption: "Click Invite user",
          },
        ]}
      />
    </div>
  );
}
