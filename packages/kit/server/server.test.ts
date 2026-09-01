import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const serverState = vi.hoisted(() => ({
  fetch: undefined as ((request: Request) => Promise<Response>) | undefined,
  readFile: vi.fn(async () => "<html>kit</html>"),
  stop: vi.fn(),
}));

vi.mock("hono/bun", () => ({
  serveStatic:
    () =>
    async (_context: unknown, next: () => Promise<void>): Promise<void> =>
      next(),
}));

// Only the SPA fallback's readFile is stubbed; the commerce module loads the
// spec package's generated artifacts through the real readFileSync at import.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    promises: { ...actual.promises, readFile: serverState.readFile },
  };
});

describe("server entrypoint", () => {
  const originalPort = process.env.PORT;
  const originalStaticRoot = process.env.STATIC_ROOT;
  const originalConvexUrl = process.env.VITE_KIT_CONVEX_URL;
  const originalSigtermListeners = process.listeners("SIGTERM");
  const originalSigintListeners = process.listeners("SIGINT");

  beforeAll(async () => {
    process.env.PORT = "3010";
    process.env.STATIC_ROOT = "/tmp/openiap-kit-static";
    process.env.VITE_KIT_CONVEX_URL = "https://placeholder.convex.cloud";
    vi.stubGlobal("Bun", {
      serve: vi.fn(
        (options: {
          port: number;
          fetch: (request: Request) => Promise<Response>;
        }) => {
          serverState.fetch = options.fetch;
          return { port: options.port, stop: serverState.stop };
        },
      ),
    });

    await import("./server");
  });

  afterAll(() => {
    for (const listener of process.listeners("SIGTERM")) {
      if (!originalSigtermListeners.includes(listener)) {
        process.removeListener("SIGTERM", listener);
      }
    }
    for (const listener of process.listeners("SIGINT")) {
      if (!originalSigintListeners.includes(listener)) {
        process.removeListener("SIGINT", listener);
      }
    }
    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    if (originalStaticRoot === undefined) delete process.env.STATIC_ROOT;
    else process.env.STATIC_ROOT = originalStaticRoot;
    if (originalConvexUrl === undefined) {
      delete process.env.VITE_KIT_CONVEX_URL;
    } else {
      process.env.VITE_KIT_CONVEX_URL = originalConvexUrl;
    }
    vi.unstubAllGlobals();
  });

  it("serves health, hard API 404s, and the cached SPA shell", async () => {
    const fetch = serverState.fetch;
    expect(fetch).toBeDefined();
    if (!fetch) throw new Error("server fetch handler was not captured");

    const health = await fetch(new Request("http://localhost/health"));
    expect(health.status).toBe(200);

    const apiMiss = await fetch(
      new Request("http://localhost/api/v1/removed-endpoint"),
    );
    expect(apiMiss.status).toBe(404);

    const v2 = await fetch(new Request("http://localhost/v2"));
    expect(v2.status).toBe(200);
    await expect(v2.json()).resolves.toMatchObject({ version: "2" });

    const v2Miss = await fetch(
      new Request("http://localhost/api/v2/removed-endpoint"),
    );
    expect(v2Miss.status).toBe(404);

    const staticMiss = await fetch(
      new Request("http://localhost/assets/missing.js"),
    );
    expect(staticMiss.status).toBe(404);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const spa = await fetch(new Request("http://localhost/dashboard"));
      expect(spa.status).toBe(200);
      expect(await spa.text()).toBe("<html>kit</html>");
    }
    expect(serverState.readFile).toHaveBeenCalledTimes(1);
  });

  it("drains once when shutdown signals arrive", () => {
    const sigterm = process
      .listeners("SIGTERM")
      .find((listener) => !originalSigtermListeners.includes(listener));
    const sigint = process
      .listeners("SIGINT")
      .find((listener) => !originalSigintListeners.includes(listener));

    expect(sigterm).toBeDefined();
    expect(sigint).toBeDefined();
    sigterm?.("SIGTERM");
    sigint?.("SIGINT");
    expect(serverState.stop).toHaveBeenCalledTimes(1);
  });

  it("caches a missing SPA shell failure", async () => {
    serverState.readFile.mockClear();
    serverState.readFile.mockRejectedValueOnce(new Error("missing index"));
    vi.resetModules();
    await import("./server");
    const fetch = serverState.fetch;
    expect(fetch).toBeDefined();
    if (!fetch) throw new Error("server fetch handler was not captured");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(new Request("http://localhost/dashboard"));
      expect(response.status).toBe(500);
      expect(await response.text()).toContain("index.html missing");
    }
    expect(serverState.readFile).toHaveBeenCalledTimes(1);
  });
});
