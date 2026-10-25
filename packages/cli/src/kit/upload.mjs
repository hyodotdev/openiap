import path from "node:path";
import { KitError } from "./client.mjs";
import { readLocalFile } from "./files.mjs";

export async function uploadFile(client, args, file, purpose) {
  if (!file || !args.organizationId)
    throw new KitError(
      "INVALID_INPUT",
      "Use --path (or --credential-file) and --org; store credentials also require --project.",
    );
  const fileName = path.basename(file);
  const fileType = fileName.endsWith(".png")
    ? "image/png"
    : /\.jpe?g$/i.test(fileName)
      ? "image/jpeg"
      : fileName.endsWith(".json")
        ? "application/json"
        : "application/octet-stream";
  const content = await readLocalFile(file, 10 * 1024 * 1024);
  const reservation = await client.run("files reserve", {
    organizationId: args.organizationId,
    ...(args.projectId ? { projectId: args.projectId } : {}),
  });
  let uploaded;
  try {
    const response = await fetch(reservation.uploadUrl, {
      method: "POST",
      headers: { "content-type": fileType },
      body: content,
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error("upload failed");
    uploaded = await response.json();
  } catch {
    throw new KitError(
      "UPLOAD_FAILED",
      "Storage upload failed. Retry the upload command.",
    );
  }
  if (typeof uploaded.storageId !== "string")
    throw new KitError("INVALID_RESPONSE", "Storage did not return a file ID.");
  const metadata = {
    organizationId: args.organizationId,
    ...(args.projectId ? { projectId: args.projectId } : {}),
    uploadReservationId: reservation.uploadReservationId,
    storageId: uploaded.storageId,
    fileName,
    fileType,
    fileSize: content.byteLength,
  };
  if (purpose === "android_service_account")
    await client.run("files validate-google", metadata);
  if (purpose === "apple_iap_review_screenshot")
    await client.run("files validate-screenshot", metadata);
  return client.run("files save", {
    ...metadata,
    purpose,
    isInternal: true,
    ...(args.description ? { description: args.description } : {}),
  });
}
