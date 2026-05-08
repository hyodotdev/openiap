const STATIC_FILE_EXTENSION =
  /\.(?:avif|css|csv|gif|ico|jpe?g|js|json|map|md|mjs|otf|pdf|png|svg|ttf|txt|webmanifest|webp|woff2?|ya?ml|xml)$/i;

const ASSET_PATH = /^\/assets(?:\/|$)/i;

export function shouldReturnNotFoundForMissingStaticPath(
  requestPath: string,
): boolean {
  const pathOnly = requestPath.split("?")[0] ?? "";
  return ASSET_PATH.test(pathOnly) || STATIC_FILE_EXTENSION.test(pathOnly);
}
