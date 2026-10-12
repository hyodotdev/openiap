// Preserve resolver implementations and handler constructors shipped in Client Protocol 1.0.
export const ADDITIONAL_OPERATION_FIELDS: Record<string, readonly string[]> = {
  Query: ['verifyAppOwnership'],
};
