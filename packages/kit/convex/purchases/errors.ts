import { ConvexError } from "convex/values";

export abstract class ReceiptVerificationError extends ConvexError<string> {
  public readonly errorCode: string;
  public readonly errorMessage: string;
  public readonly errorDetails?: Record<string, any>;

  constructor(
    errorCode: string,
    message: string,
    details?: Record<string, any>,
  ) {
    const errorData = JSON.stringify({
      error: errorCode,
      message,
      details,
    });
    super(errorData);

    this.errorCode = errorCode;
    this.errorMessage = message;
    this.errorDetails = details;
  }
}

export class InvalidApiKeyError extends ReceiptVerificationError {
  constructor() {
    super("INVALID_API_KEY", "Invalid API key");
  }
}

export class ProjectMetaHorizonNotEnabledError extends ReceiptVerificationError {
  constructor() {
    super(
      "META_HORIZON_NOT_ENABLED",
      "Meta Horizon is not enabled for this project. Toggle the Horizon section in project settings before calling /v1/purchase/verify with store=horizon.",
    );
  }
}

export class ProjectMetaHorizonAppIdNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "META_HORIZON_APP_ID_NOT_CONFIGURED",
      "Meta Horizon App ID is not set for this project.",
    );
  }
}

export class ProjectMetaHorizonAppSecretNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "META_HORIZON_APP_SECRET_NOT_CONFIGURED",
      "Meta Horizon App Secret is not set for this project. The server combines App ID + App Secret into the access token sent to Meta's verify_entitlement endpoint.",
    );
  }
}

export class MetaHorizonVerificationError extends ReceiptVerificationError {
  constructor(detail: string) {
    super(
      "META_HORIZON_VERIFICATION_ERROR",
      `Meta Horizon verification failed: ${detail}`,
      { originalError: detail },
    );
  }
}

export class AmazonSharedSecretNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "AMAZON_SHARED_SECRET_NOT_CONFIGURED",
      "Amazon RVS shared secret is not set for this project. Configure it in project settings before verifying production Amazon receipts.",
    );
  }
}

export class AmazonReceiptInvalidError extends ReceiptVerificationError {
  constructor(status: number, detail: string) {
    super(
      "AMAZON_RECEIPT_INVALID",
      `Amazon RVS rejected the receipt: ${detail}`,
      { status },
    );
  }
}

export class AmazonReceiptVerificationError extends ReceiptVerificationError {
  constructor(detail: string, details?: Record<string, any>) {
    super(
      "AMAZON_RECEIPT_VERIFICATION_ERROR",
      `Amazon RVS verification failed: ${detail}`,
      { originalError: detail, ...details },
    );
  }
}

export class PlayStoreServiceAccountNotFoundError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_SERVICE_ACCOUNT_NOT_FOUND",
      "Android service account file not found for this project",
    );
  }
}

export class PlayStoreFileContentNotReadableError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_FILE_CONTENT_NOT_READABLE",
      "Could not read service account file content",
    );
  }
}

export class FileNotFoundError extends ReceiptVerificationError {
  constructor() {
    super("FILE_NOT_FOUND", "File not found");
  }
}

export class FileContentNotFoundInStorageError extends ReceiptVerificationError {
  constructor() {
    super(
      "FILE_CONTENT_NOT_FOUND_IN_STORAGE",
      "File content not found in storage",
    );
  }
}

export class InvalidServiceAccountKeyFormatError extends ReceiptVerificationError {
  constructor() {
    super(
      "INVALID_SERVICE_ACCOUNT_KEY_FORMAT",
      "Invalid service account key format",
    );
  }
}

export class InvalidServiceAccountTypeError extends ReceiptVerificationError {
  constructor(type: string) {
    super(
      "INVALID_SERVICE_ACCOUNT_TYPE",
      `Invalid service account type: ${type}`,
      { receivedType: type },
    );
  }
}

export class ServiceAccountPrivateKeyMissingError extends ReceiptVerificationError {
  constructor() {
    super(
      "SERVICE_ACCOUNT_PRIVATE_KEY_MISSING",
      "Service account private key is missing",
    );
  }
}

export class ServiceAccountClientEmailMissingError extends ReceiptVerificationError {
  constructor() {
    super(
      "SERVICE_ACCOUNT_CLIENT_EMAIL_MISSING",
      "Service account client email is missing",
    );
  }
}

export class ServiceAccountProjectIdMissingError extends ReceiptVerificationError {
  constructor() {
    super(
      "SERVICE_ACCOUNT_PROJECT_ID_MISSING",
      "Service account project_id is missing",
    );
  }
}

export class PlayStoreAuthenticationFailedError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_AUTHENTICATION_FAILED",
      "Service account authentication failed. The JSON key file may be corrupted or invalid. Please re-download the service account key from Google Cloud Console and upload it again.",
    );
  }
}

export class PlayStoreInvalidCredentialsError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_INVALID_CREDENTIALS",
      "Authentication failed. Please check that the service account JSON file is valid and for the correct Google Cloud project.",
    );
  }
}

export class PlayStoreInsufficientPermissionsError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_INSUFFICIENT_PERMISSIONS",
      "Service account lacks permissions. Please ensure the service account has 'Financial Data Viewer' role in Google Play Console for this app.",
    );
  }
}

export class PlayStorePurchaseNotFoundError extends ReceiptVerificationError {
  constructor() {
    super(
      "PLAY_STORE_PURCHASE_NOT_FOUND",
      "Purchase not found. Please check that the productId and purchaseToken are correct.",
    );
  }
}

export class PlayStorePurchaseVerificationFailedError extends ReceiptVerificationError {
  constructor(originalError: string) {
    super(
      "PLAY_STORE_PURCHASE_VERIFICATION_FAILED",
      `Purchase verification failed: ${originalError}`,
      { originalError },
    );
  }
}

export function isPlayStoreTokenNoLongerValidError(
  error: PlayStorePurchaseVerificationFailedError,
): boolean {
  const original = String(
    error.errorDetails?.originalError ?? "",
  ).toLowerCase();
  const fallback = error.errorMessage.toLowerCase();
  return (
    original.includes("purchase token is no longer valid") ||
    fallback.includes("purchase token is no longer valid")
  );
}

export function isPlayStorePackageNameMismatchError(
  error: PlayStorePurchaseVerificationFailedError,
): boolean {
  const original = String(
    error.errorDetails?.originalError ?? "",
  ).toLowerCase();
  const fallback = error.errorMessage.toLowerCase();
  return (
    original.includes("purchase token does not match the package name") ||
    fallback.includes("purchase token does not match the package name")
  );
}

export class PlayStoreVerificationError extends ReceiptVerificationError {
  constructor(originalError: unknown) {
    const errorMessage =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);
    super(
      "PLAY_STORE_VERIFICATION_ERROR",
      `Failed to verify Google Play purchase: ${errorMessage}`,
      { originalError: errorMessage },
    );
  }
}

export class AppStoreProductionRequiresAppAppleIdError extends ReceiptVerificationError {
  constructor() {
    super(
      "APP_STORE_PRODUCTION_REQUIRES_APP_APPLE_ID",
      "appAppleId is required when using production environment. Please provide appAppleId parameter or use sandbox environment.",
    );
  }
}

export type AppStoreServerCredentialField = "issuerId" | "keyId" | "privateKey";

export class AppStoreServerCredentialsMissingError extends ReceiptVerificationError {
  constructor(missing: AppStoreServerCredentialField[]) {
    super(
      "APP_STORE_SERVER_CREDENTIALS_MISSING",
      "App Store Server API credentials are incomplete. Please provide Issuer ID, Key ID, and upload the .p8 private key.",
      { missing },
    );
  }
}

export class ProjectAndroidPackageNameNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "PROJECT_ANDROID_PACKAGE_NAME_NOT_CONFIGURED",
      "Android package name is not configured for this project. Please set it in project settings.",
    );
  }
}

export class ProjectAppStoreBundleIdNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "PROJECT_APP_STORE_BUNDLE_ID_NOT_CONFIGURED",
      "App Store bundle ID is not configured for this project. Please set it in project settings.",
    );
  }
}

export class ProjectAppStoreAppleIdNotConfiguredError extends ReceiptVerificationError {
  constructor() {
    super(
      "PROJECT_APP_STORE_APPLE_ID_NOT_CONFIGURED",
      "App Apple ID is required for production verifications. Please set it in project settings.",
    );
  }
}

export class AppStoreBundleIdMismatchError extends ReceiptVerificationError {
  constructor(expected: string, received: string) {
    super(
      "APP_STORE_BUNDLE_ID_MISMATCH",
      `Configured bundle ID (${expected}) does not match the receipt bundle ID (${received}).`,
      { expected, received },
    );
  }
}

export class AppStoreInvalidJWSFormatError extends ReceiptVerificationError {
  constructor() {
    super("APP_STORE_INVALID_JWS_FORMAT", "Invalid JWS format");
  }
}

export class AppStoreTransactionVerificationFailedError extends ReceiptVerificationError {
  constructor(message: string = "Unknown verification error") {
    super(
      "APP_STORE_TRANSACTION_VERIFICATION_FAILED",
      `App Store transaction verification failed: ${message}`,
    );
  }
}

export class AppStoreVerificationError extends ReceiptVerificationError {
  constructor(originalError: unknown) {
    const errorMessage =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);
    super(
      "APP_STORE_VERIFICATION_ERROR",
      `Failed to verify App Store purchase: ${errorMessage}`,
      { originalError: errorMessage },
    );
  }
}

export function createAppStoreError(error: unknown): ReceiptVerificationError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes("Invalid JWS")) {
    return new AppStoreInvalidJWSFormatError();
  }

  if (errorMessage.includes("appAppleId is required")) {
    return new AppStoreProductionRequiresAppAppleIdError();
  }

  return new AppStoreTransactionVerificationFailedError();
}

export function createPlayStoreError(error: unknown): ReceiptVerificationError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("invalid_grant") ||
    errorMessage.includes("Invalid JWT")
  ) {
    return new PlayStoreAuthenticationFailedError();
  }

  if (errorMessage.includes("insufficient permissions")) {
    return new PlayStoreInsufficientPermissionsError();
  }

  if ((error as any).code === 404 || errorMessage.includes("not found")) {
    return new PlayStorePurchaseNotFoundError();
  }

  if ((error as any).code === 401) {
    return new PlayStoreInvalidCredentialsError();
  }

  return new PlayStorePurchaseVerificationFailedError(errorMessage);
}
