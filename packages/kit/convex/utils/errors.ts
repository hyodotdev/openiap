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

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string = "",
    public statusCode: number = 400,
  ) {
    super(message || code);
    this.name = "AppError";
  }
}

// Helper function to create standardized errors
export function createError(code: ErrorCode, details?: string): AppError {
  // Always include the error code in the message so frontend can parse it
  // Frontend will use the error code to display localized messages
  const message = details ? `${code}: ${details}` : code;

  return new AppError(code, message);
}
