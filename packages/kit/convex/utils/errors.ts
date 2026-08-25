import { ConvexError } from "convex/values";

// Error codes for consistent error handling across the application
export enum ErrorCode {
  // Authentication & Authorization
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
  NOT_AUTHORIZED = "NOT_AUTHORIZED",

  // User errors
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",

  // Organization errors
  ORGANIZATION_NOT_FOUND = "ORGANIZATION_NOT_FOUND",
  NOT_ORGANIZATION_MEMBER = "NOT_ORGANIZATION_MEMBER",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  USER_NOT_REGISTERED = "USER_NOT_REGISTERED",
  USER_ALREADY_MEMBER = "USER_ALREADY_MEMBER",
  CANNOT_REMOVE_OWNER = "CANNOT_REMOVE_OWNER",
  CANNOT_UPDATE_OWN_ROLE = "CANNOT_UPDATE_OWN_ROLE",
  SLUG_NOT_AVAILABLE = "SLUG_NOT_AVAILABLE",

  // Project errors
  PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
  PROJECT_ALREADY_EXISTS = "PROJECT_ALREADY_EXISTS",

  // API Key errors
  API_KEY_NOT_FOUND = "API_KEY_NOT_FOUND",
  API_KEY_INVALID = "API_KEY_INVALID",
  API_KEY_EXPIRED = "API_KEY_EXPIRED",

  // Receipt errors
  RECEIPT_NOT_FOUND = "RECEIPT_NOT_FOUND",
  RECEIPT_INVALID = "RECEIPT_INVALID",
  RECEIPT_ALREADY_EXISTS = "RECEIPT_ALREADY_EXISTS",

  // General errors
  INVALID_INPUT = "INVALID_INPUT",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SERVER_ERROR = "SERVER_ERROR",
}

// Marks payloads meant for the dashboard. `/v1` route layers reject this
// scope so internal codes stay out of the published response contract.
export const APP_ERROR_SCOPE = "dashboard";

/** Payload the client receives on `ConvexError.data`. */
export interface AppErrorData {
  code: ErrorCode;
  message: string;
  scope: string;
  // Convex requires an index signature for structured error payloads.
  [key: string]: string;
}

// Convex redacts plain `Error` messages to "Server Error" on production
// deployments; only ConvexError data crosses to the client.
export class AppError extends ConvexError<AppErrorData> {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, details?: string) {
    super({ code, message: details ?? code, scope: APP_ERROR_SCOPE });
    this.name = "AppError";
    // Keep server logs keyed by the code rather than the JSON payload.
    this.message = details ? `${code}: ${details}` : code;
    this.code = code;
  }
}

// Helper function to create standardized errors
export function createError(code: ErrorCode, details?: string): AppError {
  return new AppError(code, details);
}
