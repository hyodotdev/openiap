export function resolveBrowserConvexUrl(
  env: Readonly<Record<string, unknown>>,
): string {
  const convexUrl = [env.VITE_KIT_CONVEX_URL, env.VITE_CONVEX_URL].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  if (!convexUrl) {
    throw new Error(
      "Set VITE_KIT_CONVEX_URL or run `convex dev` to generate VITE_CONVEX_URL.",
    );
  }

  return convexUrl.trim();
}
