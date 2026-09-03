export const generatedFileHeader = (commentPrefix = '//'): string[] => [
  `${commentPrefix} ============================================================================`,
  `${commentPrefix} AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY`,
  `${commentPrefix} Refresh this file with the generated-types workflow documented for your checkout.`,
  `${commentPrefix} ============================================================================`,
];
