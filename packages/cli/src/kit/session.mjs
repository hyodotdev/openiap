import { createHash, randomBytes } from "node:crypto";
import { mkdir, rename, unlink, writeFile, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { readLocalFile } from "./files.mjs";

function validateTokens(tokens) {
  if (
    !tokens ||
    typeof tokens.token !== "string" ||
    typeof tokens.refreshToken !== "string" ||
    !tokens.token ||
    !tokens.refreshToken ||
    tokens.token.length > 32 * 1024 ||
    tokens.refreshToken.length > 4096
  ) {
    throw Object.assign(
      new Error("Invalid CLI credentials. Run openiap kit login again."),
      { code: "INVALID_SESSION" },
    );
  }
}

export function normalizeOrigin(value = "https://kit.openiap.dev") {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("IAPKit base URL must be a URL.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Use an HTTPS origin without a path or credentials; HTTP is allowed on localhost.",
    );
  }
  return url.origin;
}

function sessionFile(origin) {
  const directory =
    process.env.OPENIAP_CONFIG_DIR ??
    path.join(homedir(), ".config", "openiap");
  const id = createHash("sha256").update(origin).digest("hex").slice(0, 24);
  return { directory, file: path.join(directory, `${id}.json`) };
}

export async function loadSession(origin) {
  const { file } = sessionFile(origin);
  try {
    const info = await lstat(file);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      (process.platform !== "win32" && info.mode & 0o077)
    )
      throw new Error(
        "CLI credentials must be a private regular file (chmod 600).",
      );
    let session;
    try {
      session = JSON.parse(
        (await readLocalFile(file, 64 * 1024)).toString("utf8"),
      );
    } catch {
      throw Object.assign(
        new Error(
          "Saved CLI credentials could not be read. Run openiap kit login again.",
        ),
        { code: "INVALID_SESSION" },
      );
    }
    validateTokens(session);
    if (session.origin !== origin)
      throw new Error("CLI credential origin does not match.");
    return session;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveSession(origin, tokens) {
  validateTokens(tokens);
  const { directory, file } = sessionFile(origin);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (process.platform !== "win32" && info.mode & 0o077)
  )
    throw new Error("CLI credential directory must be private (chmod 700).");
  const temporary = `${file}.${randomBytes(8).toString("hex")}`;
  try {
    await writeFile(
      temporary,
      JSON.stringify({
        origin,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      }),
      {
        mode: 0o600,
        flag: "wx",
      },
    );
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

export async function removeSession(origin) {
  await unlink(sessionFile(origin).file).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}
