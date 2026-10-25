import { loadSession, saveSession } from "./session.mjs";

export class KitError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    Object.assign(this, details);
  }
}

export function kitClient(origin) {
  let session;
  async function request(route, body, token, raw = false) {
    let response;
    let text;
    try {
      response = await fetch(`${origin}${raw ? "" : "/cli/v1"}${route}`, {
        method: raw ? "GET" : "POST",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const limit = 16 * 1024 * 1024;
      const chunks = [];
      let size = 0;
      const reader = response.body?.getReader();
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > limit) {
            await reader.cancel().catch(() => {});
            throw new KitError(
              "RESPONSE_TOO_LARGE",
              "Use a smaller page size.",
            );
          }
          chunks.push(value);
        }
      }
      text = Buffer.concat(chunks).toString("utf8");
    } catch (error) {
      if (error instanceof KitError) throw error;
      throw new KitError(
        "NETWORK_ERROR",
        "IAPKit could not be reached. Check --base-url and your connection.",
      );
    }
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new KitError(
        "INVALID_RESPONSE",
        "IAPKit did not return JSON. The server may need the CLI update deployed.",
        { status: response.status },
      );
    }
    if (!response.ok || (!raw && !result.ok)) {
      throw new KitError(
        result.error?.code ?? "REQUEST_FAILED",
        result.error?.message ?? `IAPKit returned HTTP ${response.status}.`,
        { status: response.status, retryAfterSec: result.error?.retryAfterSec },
      );
    }
    return raw ? result : result.data;
  }
  async function accessToken() {
    if (!session) {
      if (process.env.IAPKIT_TOKEN) {
        session = await request("/auth/token", {
          token: process.env.IAPKIT_TOKEN,
        });
      } else session = await loadSession(origin);
    }
    if (!session?.token || !session.refreshToken)
      throw new KitError(
        "UNAUTHENTICATED",
        "Run npx @hyodotdev/openiap kit login.",
      );
    let expires;
    try {
      expires = JSON.parse(
        Buffer.from(session.token.split(".")[1], "base64url").toString(),
      ).exp;
    } catch {
      throw new KitError("INVALID_SESSION", "Run openiap kit login again.");
    }
    if (typeof expires !== "number")
      throw new KitError("INVALID_SESSION", "Run openiap kit login again.");
    if (expires * 1000 < Date.now() + 60_000) {
      session = await request("/auth/refresh", {
        refreshToken: session.refreshToken,
      });
      if (!process.env.IAPKIT_TOKEN) await saveSession(origin, session);
    }
    return session.token;
  }
  return {
    request,
    health: () => request("/health", undefined, undefined, true),
    run: async (command, args = {}, confirmed = false) =>
      request("/run", { command, args, confirmed }, await accessToken()),
  };
}
