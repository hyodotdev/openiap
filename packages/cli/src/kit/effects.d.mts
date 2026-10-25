export function requiresConfirmation(
  operation: { command: string; effect: string },
  args: Record<string, unknown>,
): boolean;
