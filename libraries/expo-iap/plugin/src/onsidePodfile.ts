const ONSIDE_ENV_LINE = "ENV['EXPO_IAP_ONSIDE'] = '1'";
const ONSIDE_ENV_ASSIGNMENT =
  /^\s*ENV\[\s*['"]EXPO_IAP_ONSIDE['"]\s*\]\s*=\s*['"][^'"]*['"]\s*\n?/gm;

export const ensureOnsidePodIOS = (content: string): string => {
  const assignments = content.match(ONSIDE_ENV_ASSIGNMENT) ?? [];
  if (assignments.length === 1 && content.startsWith(`${ONSIDE_ENV_LINE}\n`)) {
    return content;
  }

  const withoutAssignments = content
    .replace(ONSIDE_ENV_ASSIGNMENT, '')
    .replace(/^\n+/, '');
  return `${ONSIDE_ENV_LINE}\n${withoutAssignments}`;
};
