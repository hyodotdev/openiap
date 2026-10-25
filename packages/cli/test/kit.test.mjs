import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSession,
  normalizeOrigin,
  saveSession,
} from "../src/kit/session.mjs";
import { kitClient } from "../src/kit/client.mjs";
import { runKit } from "../src/kit/index.mjs";
import { redactStoreEvidence } from "../src/kit/output.mjs";

const bin = fileURLToPath(new URL("../bin/openiap.mjs", import.meta.url));
let directory, origin, server;
let logoutError;
let loginPollErrors = [];
let deviceLifetime = 5000;
let syncConflict = false;
let syncJob = { status: "succeeded" };
const purchase = {
  _id: "purchase-a",
  productId: "premium",
  requestData: { store: "google", purchaseToken: "fixture-purchase-token" },
  remoteResponse: "fixture-signed-response",
  remoteId: "fixture-purchase-token",
  transactionId: "fixture-purchase-token",
  rawEvidenceVisible: true,
};
const requests = [];
const jwt = (exp = Date.now() / 1000 + 3600) =>
  `header.${Buffer.from(JSON.stringify({ exp, sub: "user|session" })).toString("base64url")}.signature`;
const tokens = () => ({ token: jwt(), refreshToken: "fixture-refresh" });

async function run(args, env = {}, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, "kit", ...args], {
      timeout: 10000,
      env: {
        ...process.env,
        IAPKIT_TOKEN: "",
        IAPKIT_BASE_URL: origin,
        OPENIAP_CONFIG_DIR: directory,
        ...env,
      },
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    if (input) {
      child.stdin.write(input[0]);
      setTimeout(() => child.stdin.end(input[1]), 200);
    } else child.stdin.end();
  });
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "openiap-cli-test-"));
  process.env.OPENIAP_CONFIG_DIR = directory;
  server = createServer(async (request, response) => {
    if (request.url === "/health") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = JSON.parse(text);
    requests.push({
      url: request.url,
      body,
      authorization: request.headers.authorization,
    });
    if (
      request.url === "/cli/v1/auth/token" &&
      body.deviceCode &&
      loginPollErrors.length
    ) {
      const failure = loginPollErrors.shift();
      response.writeHead(failure.status, {
        "Content-Type": failure.html ? "text/html" : "application/json",
      });
      if (failure.disconnect) {
        response.flushHeaders();
        response.write('{"ok":');
        setImmediate(() => response.destroy());
      } else
        response.end(
          failure.html
            ? "Gateway temporarily unavailable"
            : JSON.stringify({
                ok: false,
                error: {
                  code: failure.code,
                  message: "Fixture login response",
                },
              }),
        );
      return;
    }
    if (body.command === "sync products" && syncConflict) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "INVALID_INPUT",
            message:
              "A different sync is already running. Wait for or cancel job preview-a.",
          },
        }),
      );
      return;
    }
    if (body.command === "logout" && logoutError) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: false,
          error: { code: logoutError, message: "Sign in again." },
        }),
      );
      return;
    }
    let data;
    if (request.url === "/cli/v1/auth/device")
      data = {
        deviceCode: "device-secret",
        userCode: "ABCD123456",
        verificationUrl: `${origin}/cli/authorize?user_code=ABCD123456`,
        interval: 0,
        expiresAt: Date.now() + deviceLifetime,
      };
    else if (request.url.startsWith("/cli/v1/auth/")) data = tokens();
    else if (body.command === "orgs list")
      data = [{ _id: "org-a" }, { _id: "org-b" }];
    else if (body.command === "projects list")
      data = [{ _id: `${body.args.organizationId}-project` }];
    else if (body.command === "sync products") data = { jobId: "job-a" };
    else if (body.command === "sync status") data = syncJob;
    else if (body.command === "purchases get") data = purchase;
    else if (body.command === "purchases list")
      data = { page: [purchase], isDone: true, continueCursor: "" };
    else if (body.command === "webhooks notifications")
      data = {
        page: [
          {
            store: "apple",
            transactionId: "fixture-purchase-token",
            originalTransactionId: "fixture-purchase-token",
            productId: "premium",
            rawEvidenceVisible: true,
          },
        ],
      };
    else if (["webhooks list", "webhooks failed"].includes(body.command))
      data = [
        {
          _id: "destination-a",
          url: "https://user:fixture-token@receiver.example/fixture-token?key=fixture-token",
          lastError: "Receiver rejected fixture-token",
        },
      ];
    else if (body.command === "tokens create")
      data = { token: "one-time-fixture-token" };
    else if (body.command === "credentials download")
      data = {
        fileName: "review.png",
        mimeType: "image/png",
        base64: Buffer.alloc(7 * 1024 * 1024).toString("base64"),
      };
    else data = { command: body.command, args: body.args };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ ok: true, data }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  delete process.env.OPENIAP_CONFIG_DIR;
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

test("kit schema discovers commands without contacting IAPKit or exposing transport authentication", async () => {
  const count = requests.length;
  const result = await run(["schema", "keys", "create", "--json"]);
  assert.equal(result.status, 0);
  const schema = JSON.parse(result.stdout).data.inputSchema;
  assert.ok(schema.properties.keyType);
  assert.equal(schema.properties.apiKey, undefined);
  assert.deepEqual(schema.required, ["projectId", "name", "keyType"]);
  assert.equal(requests.length, count);
});

test("setup renders the shared framework snippets without authentication", async () => {
  const count = requests.length;
  const result = await run([
    "setup",
    "--framework",
    "expo",
    "--product-id",
    "premium",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).data.snippet, /expo-iap/);
  assert.match(
    JSON.parse(result.stdout).data.snippet,
    /IAPKIT_PUBLISHABLE_KEY/,
  );
  assert.equal(requests.length, count);
});

test("health probes the server independently of login", async () => {
  const result = await run(["health", "--json"], {
    OPENIAP_CONFIG_DIR: path.join(directory, "no-login"),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.status, "ok");
});

test("interrupted response bodies return the stable network error code", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(
              new DOMException("Connection interrupted", "AbortError"),
            );
          },
        }),
      ),
  );
  await assert.rejects(kitClient(origin).health(), { code: "NETWORK_ERROR" });
});

test("oversized responses keep their error code when cancellation fails", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(16 * 1024 * 1024 + 1));
          },
          cancel() {
            throw new Error("Connection closed during cancellation");
          },
        }),
      ),
  );
  await assert.rejects(kitClient(origin).health(), {
    code: "RESPONSE_TOO_LARGE",
  });
});

test("browser login persists a private session reused by separate CLI processes", async () => {
  const login = await run(["login", "--no-browser", "--json"]);
  assert.equal(login.status, 0, login.stderr);
  assert.match(login.stderr, /ABCD123456/);
  assert.doesNotMatch(
    login.stdout + login.stderr,
    /device-secret|fixture-refresh|signature/,
  );
  const files = await readdir(directory);
  assert.equal(files.length, 1);
  assert.equal(
    (await stat(path.join(directory, files[0]))).mode & 0o777,
    0o600,
  );
  const whoami = await run(["whoami", "--json"]);
  assert.equal(whoami.status, 0, whoami.stderr);
  assert.match(requests.at(-1).authorization, /^Bearer header\./);
  assert.doesNotMatch(whoami.stdout, /fixture-refresh|signature/);
});

test("expired access tokens refresh before sending a mutation", async () => {
  await saveSession(origin, { token: jwt(1), refreshToken: "fixture-refresh" });
  const result = await run([
    "keys",
    "create",
    "--project",
    "project-a",
    "--name",
    "CI",
    "--key-type",
    "secret",
    "--yes",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.at(-2).url, "/cli/v1/auth/refresh");
  assert.deepEqual(requests.at(-1).body.args, {
    projectId: "project-a",
    name: "CI",
    keyType: "secret",
  });
});

test("destructive commands and invalid --wait never send a mutation", async () => {
  const count = requests.length;
  const denied = await run(["keys", "revoke", "--key", "key-a", "--json"]);
  assert.equal(JSON.parse(denied.stdout).error.code, "CONFIRMATION_REQUIRED");
  assert.equal(requests.length, count);
  const wait = await run([
    "keys",
    "create",
    "--project",
    "p",
    "--name",
    "CI",
    "--key-type",
    "secret",
    "--wait",
    "--json",
  ]);
  assert.equal(wait.status, 1);
  assert.equal(requests.length, count);
  const approved = await run([
    "keys",
    "revoke",
    "--key",
    "key-a",
    "--yes",
    "--json",
  ]);
  assert.equal(approved.status, 0, approved.stderr);
  assert.equal(requests.at(-1).body.confirmed, true);
});

test("output and timeout failures are checked before any secret or store mutation", async () => {
  const count = requests.length;
  const file = path.join(directory, "existing-output.json");
  await writeFile(file, "keep existing work");
  const key = await run([
    "keys",
    "regenerate",
    "--key",
    "k",
    "--yes",
    "--output",
    file,
    "--json",
  ]);
  assert.equal(key.status, 1);
  assert.equal(requests.length, count);
  assert.equal(await readFile(file, "utf8"), "keep existing work");
  const sync = await run([
    "sync",
    "products",
    "--project",
    "p",
    "--store",
    "apple",
    "--apply",
    "--yes",
    "--wait",
    "--timeout",
    "invalid",
    "--json",
  ]);
  assert.equal(sync.status, 1);
  assert.equal(requests.length, count);
});

for (const args of [
  [
    "tokens",
    "create",
    "--name",
    "CI",
    "--scope",
    "read",
    "--expires-in-days",
    "1",
  ],
  ["keys", "create", "--project", "p", "--name", "CI", "--key-type", "secret"],
  [
    "webhooks",
    "create",
    "--project",
    "p",
    "--url",
    "https://example.com/events",
  ],
  ["credentials", "download", "--file-id", "file-a"],
]) {
  test(`${args.slice(0, 2).join(" ")} requires confirmation before credentials or network access`, async () => {
    const count = requests.length;
    const result = await run([...args, "--json"]);
    assert.equal(JSON.parse(result.stdout).error.code, "CONFIRMATION_REQUIRED");
    assert.equal(requests.length, count);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /one-time-fixture-token/,
    );
  });
}

test("confirmed token output is private and absent from stdout", async () => {
  const file = path.join(directory, "automation-token.json");
  const result = await run([
    "tokens",
    "create",
    "--name",
    "CI",
    "--scope",
    "read",
    "--expires-in-days",
    "1",
    "--yes",
    "--output",
    file,
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(await readFile(file, "utf8")).token,
    "one-time-fixture-token",
  );
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.doesNotMatch(result.stdout + result.stderr, /one-time-fixture-token/);
  assert.equal(requests.at(-1).body.confirmed, true);
});

test("key deactivation requires confirmation through flags and JSON input", async () => {
  const count = requests.length;
  const file = path.join(directory, "deactivate-key.json");
  await writeFile(file, JSON.stringify({ keyId: "k", isActive: false }));
  for (const args of [
    ["--key", "k", "--is-active", "false"],
    ["--file", file],
  ]) {
    const result = await run(["keys", "update", ...args, "--json"]);
    assert.equal(JSON.parse(result.stdout).error.code, "CONFIRMATION_REQUIRED");
    assert.equal(requests.length, count);
  }
  const rename = await run([
    "keys",
    "update",
    "--key",
    "k",
    "--name",
    "Renamed",
    "--json",
  ]);
  assert.equal(rename.status, 0, rename.stderr);
  const disable = await run([
    "keys",
    "update",
    "--file",
    file,
    "--yes",
    "--json",
  ]);
  assert.equal(disable.status, 0, disable.stderr);
  assert.equal(requests.at(-1).body.args.isActive, false);
  assert.equal(requests.at(-1).body.confirmed, true);
});

test("JSON files supply nested values and flags override selected fields", async () => {
  const file = path.join(directory, "product.json");
  await writeFile(
    file,
    JSON.stringify({
      projectId: "p",
      productId: "premium",
      platform: "IOS",
      type: "Subscription",
      title: "Original",
      localizations: [{ locale: "en-US", title: "Premium" }],
    }),
  );
  const result = await run([
    "products",
    "create",
    "--file",
    file,
    "--title",
    "Updated",
    "--regions",
    "all",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.at(-1).body.args.title, "Updated");
  assert.equal(requests.at(-1).body.args.localizations[0].locale, "en-US");
  assert.equal(requests.at(-1).body.args.regions, "all");
});

test("nullable credential strings accept values and JSON null for clearing", async () => {
  const tax = await run([
    "orgs",
    "update",
    "--org",
    "org-a",
    "--tax-id",
    "123456789",
    "--json",
  ]);
  assert.equal(tax.status, 0, tax.stderr);
  assert.equal(requests.at(-1).body.args.taxId, "123456789");
  const configured = await run([
    "credentials",
    "configure",
    "--project",
    "p",
    "--amazon-shared-secret",
    "fixture-sensitive-value",
    "--json",
  ]);
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(
    requests.at(-1).body.args.amazonSharedSecret,
    "fixture-sensitive-value",
  );
  const cleared = await run([
    "credentials",
    "configure",
    "--project",
    "p",
    "--amazon-shared-secret",
    "null",
    "--json",
  ]);
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.equal(requests.at(-1).body.args.amazonSharedSecret, null);
});

test("piped JSON preserves UTF-8 split across input chunks", async () => {
  const body = Buffer.from(
    JSON.stringify({
      projectId: "p",
      productId: "premium",
      platform: "IOS",
      type: "NonConsumable",
      title: "한글",
    }),
  );
  const boundary = body.indexOf(Buffer.from("한")) + 1;
  const result = await run(
    ["products", "create", "--file", "-", "--json"],
    {},
    [body.subarray(0, boundary), body.subarray(boundary)],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests.at(-1).body.args.title, "한글");
});

test("downloads supported screenshot sizes without printing base64", async () => {
  const file = path.join(directory, "review.png");
  const result = await run([
    "credentials",
    "download",
    "--file-id",
    "file-a",
    "--yes",
    "--output",
    file,
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await stat(file)).size, 7 * 1024 * 1024);
  assert.equal(JSON.parse(result.stdout).data.saved, true);
  assert.ok(result.stdout.length < 1024);
});

test("projects list explicitly visits every accessible organization", async () => {
  const result = await run(["projects", "list", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.length, 2);
});

test("sync is a dry run unless explicitly applied and supports job waiting", async () => {
  const preview = await run([
    "sync",
    "products",
    "--project",
    "p",
    "--store",
    "apple",
    "--json",
  ]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(requests.at(-1).body.args.dryRun, true);
  assert.equal(requests.at(-1).body.args.platform, "IOS");
  const apply = await run([
    "sync",
    "products",
    "--project",
    "p",
    "--store",
    "google",
    "--apply",
    "--yes",
    "--wait",
    "--json",
  ]);
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(JSON.parse(apply.stdout).data.status, "succeeded");
  assert.equal(requests.at(-2).body.args.dryRun, false);
});

for (const args of [
  ["purchases", "get", "--purchase-id", "purchase-a"],
  ["purchases", "list", "--project", "p"],
  ["webhooks", "notifications", "--project", "p"],
]) {
  test(`${args.slice(0, 2).join(" ")} hides replayable evidence from an older raw response`, async () => {
    const result = await run([...args, "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /fixture-purchase-token|fixture-signed-response/,
    );
    const data = JSON.parse(result.stdout).data;
    const row = data.page ? data.page[0] : data;
    assert.equal(row.productId, "premium");
    assert.equal(row.rawEvidenceVisible, false);
    assert.equal(row.remoteId, undefined);
    assert.equal(row.transactionId, undefined);
  });
}

for (const command of ["list", "failed"]) {
  test(`webhooks ${command} hides receiver credentials from older responses`, async () => {
    const result = await run(["webhooks", command, "--project", "p", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).data, [
      { _id: "destination-a", destinationHost: "receiver.example" },
    ]);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /fixture-token|lastError/,
    );
  });
}

test("catalog payload fields are preserved when they resemble store evidence", () => {
  const payload = {
    body: {
      remoteId: "catalog-rule",
      purchaseToken: "public-field",
      transactions: ["catalog-value"],
    },
  };
  assert.equal(redactStoreEvidence("payloads get", payload, false), payload);
});

test("purchase evidence needs explicit confirmation even with output files", async () => {
  for (const confirmed of [false, true]) {
    const file = path.join(directory, `purchase-${confirmed}.json`);
    const result = await run([
      "purchases",
      "get",
      "--purchase-id",
      "purchase-a",
      "--output",
      file,
      "--json",
      ...(confirmed ? ["--yes"] : []),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(await readFile(file, "utf8"));
    assert.equal(
      data.remoteId,
      confirmed ? "fixture-purchase-token" : undefined,
    );
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /fixture-purchase-token|fixture-signed-response/,
    );
  }
});

for (const job of [
  {
    status: "succeeded",
    result: {
      pulled: 0,
      pushed: 0,
      failures: [{ productId: "premium", reason: "Rejected by store" }],
    },
  },
  { status: "succeeded", progress: { failuresCount: 2 } },
  { status: "succeeded", result: { failures: [], failuresTruncated: true } },
  { status: "failed", error: "Worker stopped" },
]) {
  test(`sync waiting fails for ${JSON.stringify(job)}`, async () => {
    syncJob = job;
    try {
      const result = await run([
        "sync",
        "products",
        "--project",
        "p",
        "--store",
        "google",
        "--apply",
        "--yes",
        "--wait",
        "--json",
      ]);
      assert.equal(result.status, 1);
      const error = JSON.parse(result.stdout).error;
      assert.equal(error.code, "JOB_FAILED");
      assert.equal(error.jobId, "job-a");
      assert.equal(error.details.status, job.status);
      if (job.result)
        assert.deepEqual(error.details.failures, job.result.failures);
      if (job.progress) assert.equal(error.details.failuresCount, 2);
      if (job.error) assert.equal(error.details.error, job.error);
    } finally {
      syncJob = { status: "succeeded" };
    }
  });
}

test("automation tokens do not overwrite a developer's saved login", async () => {
  const file = (await readdir(directory)).find((name) =>
    /^[a-f0-9]{24}\.json$/.test(name),
  );
  const before = await readFile(path.join(directory, file), "utf8");
  const result = await run(["whoami", "--json"], {
    IAPKIT_TOKEN: "fixture-automation",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(path.join(directory, file), "utf8"), before);
  const count = requests.length;
  const unconfirmed = await run(["logout", "--json"], {
    IAPKIT_TOKEN: "fixture-automation",
  });
  assert.equal(
    JSON.parse(unconfirmed.stdout).error.code,
    "CONFIRMATION_REQUIRED",
  );
  assert.equal(requests.length, count);
  const logout = await run(["logout", "--yes", "--json"], {
    IAPKIT_TOKEN: "fixture-automation",
  });
  assert.equal(logout.status, 0, logout.stderr);
  assert.equal(requests.at(-1).body.confirmed, true);
  assert.equal(await readFile(path.join(directory, file), "utf8"), before);
});

test("credentials never cross origins, insecure remote HTTP is rejected", async () => {
  assert.throws(() => normalizeOrigin("http://example.com"));
  assert.throws(() => normalizeOrigin("https://kit.openiap.dev/path"));
  assert.throws(() => normalizeOrigin("https://user:password@example.com"));
  const result = await run([
    "whoami",
    "--base-url",
    "https://example.com",
    "--json",
  ]);
  assert.equal(result.status, 3);
  assert.equal(JSON.parse(result.stdout).error.code, "UNAUTHENTICATED");
});

test("malformed JSON and unknown flags fail without echoing source secrets", async () => {
  const file = path.join(directory, "malformed.json");
  await writeFile(file, "{secret-value-do-not-echo");
  const result = await run(["keys", "create", "--file", file, "--json"]);
  assert.equal(result.status, 1);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /secret-value-do-not-echo/,
  );
  const unknown = await run([
    "keys",
    "list",
    "--project",
    "p",
    "--typo",
    "--json",
  ]);
  assert.equal(unknown.status, 1);
});

test("generated input schemas reject invalid enums and nested values before authentication", async () => {
  const cases = [
    [
      "subscriptions",
      "status",
      "--project",
      "p",
      "--user-id",
      "u",
      "--environment",
      "Sandbox",
    ],
    ["keys", "create", "--project", "p", "--name", "CI", "--key-type", "owner"],
    [
      "products",
      "create",
      "--project",
      "p",
      "--product-id",
      "item",
      "--platform",
      "IOS",
      "--type",
      "Consumable",
      "--title",
      "Item",
      "--localizations",
      '[{"locale":"ko-KR","title":42}]',
    ],
    ["products", "list", "--project", "p", "--limit", "null"],
    ["projects", "list", "--org", "o", "--constructor", "hidden"],
    [
      "products",
      "create",
      "--project",
      "p",
      "--product-id",
      "item",
      "--platform",
      "IOS",
      "--type",
      "Consumable",
      "--title",
      "Item",
      "--localizations",
      '[{"locale":"ko-KR","title":"Valid","toString":"hidden"}]',
    ],
  ];
  const count = requests.length;
  for (const args of cases) {
    const result = await run([...args, "--json"]);
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stdout).error;
    assert.equal(error.code, "INVALID_INPUT");
    assert.match(error.message, /Invalid --|Unknown option/);
  }
  assert.equal(requests.length, count);
});

test(
  "non-regular JSON inputs fail without hanging or contacting IAPKit",
  { skip: process.platform === "win32" },
  async () => {
    const fifo = path.join(directory, "input.fifo");
    execFileSync("mkfifo", [fifo]);
    const count = requests.length;
    const result = await run(["keys", "create", "--file", fifo, "--json"]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "INVALID_INPUT");
    assert.equal(requests.length, count);
  },
);

test("corrupt saved credentials never appear in diagnostics", async () => {
  const file = (await readdir(directory)).find((name) =>
    /^[a-f0-9]{24}\.json$/.test(name),
  );
  await writeFile(
    path.join(directory, file),
    "{private-credential-do-not-echo",
    { mode: 0o600 },
  );
  const result = await run(["whoami", "--json"]);
  assert.equal(result.status, 3);
  assert.doesNotMatch(
    result.stdout + result.stderr,
    /private-credential-do-not-echo/,
  );
  assert.equal(JSON.parse(result.stdout).error.code, "INVALID_SESSION");
  const logout = await run(["logout", "--json"]);
  assert.equal(logout.status, 3);
  assert.equal(await loadSession(origin), null);
});

for (const code of ["UNAUTHENTICATED", "SESSION_EXPIRED"]) {
  test(`logout clears local credentials after server ${code}`, async () => {
    await saveSession(origin, tokens());
    logoutError = code;
    try {
      const result = await run(["logout", "--json"]);
      assert.equal(result.status, 3);
      assert.equal(JSON.parse(result.stdout).error.code, code);
      assert.equal(await loadSession(origin), null);
    } finally {
      logoutError = undefined;
    }
  });
}

test("logout clears local credentials when the server is unreachable", async () => {
  const unavailable = "http://127.0.0.1:1";
  await saveSession(unavailable, tokens());
  const result = await run(["logout", "--json"], {
    IAPKIT_BASE_URL: unavailable,
  });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).error.code, "NETWORK_ERROR");
  assert.equal(await loadSession(unavailable), null);
});

test("login retries a transient server failure and pending approval before succeeding", async () => {
  const count = requests.length;
  loginPollErrors = [
    { status: 503, code: "REQUEST_FAILED" },
    { status: 428, code: "AUTHORIZATION_PENDING" },
  ];
  try {
    const result = await run(["login", "--no-browser", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).data.loggedIn, true);
    assert.equal(
      requests.slice(count).filter((r) => r.url === "/cli/v1/auth/token")
        .length,
      3,
    );
  } finally {
    loginPollErrors = [];
  }
});

test("login retries a lost response and an HTML gateway error", async () => {
  loginPollErrors = [
    { status: 200, disconnect: true },
    { status: 502, html: true },
  ];
  deviceLifetime = 9000;
  try {
    const result = await run(["login", "--no-browser", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).data.loggedIn, true);
  } finally {
    loginPollErrors = [];
    deviceLifetime = 5000;
  }
});

test("login retries stop when its approval code expires", async () => {
  loginPollErrors = [{ status: 503, code: "REQUEST_FAILED" }];
  deviceLifetime = 250;
  const count = requests.length;
  try {
    const result = await run(["login", "--no-browser", "--json"]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "EXPIRED_TOKEN");
    assert.equal(
      requests.slice(count).filter((r) => r.url === "/cli/v1/auth/token")
        .length,
      1,
    );
  } finally {
    loginPollErrors = [];
    deviceLifetime = 5000;
  }
});

test("login skips a final poll when a clamped wait wakes one millisecond early", async (t) => {
  const routes = [];
  let stdout = "";
  const exitCode = process.exitCode;
  const writeStdout = process.stdout.write.bind(process.stdout);
  t.mock.method(Date, "now", () => 1000);
  t.mock.method(process.stdout, "write", (chunk, ...args) => {
    if (typeof chunk !== "string" || !chunk.startsWith("{"))
      return writeStdout(chunk, ...args);
    stdout += chunk;
    return true;
  });
  t.mock.method(process.stderr, "write", () => true);
  t.mock.method(globalThis, "fetch", async (url) => {
    routes.push(new URL(url).pathname);
    return Response.json(
      routes.length === 1
        ? {
            ok: true,
            data: {
              deviceCode: "device-secret",
              userCode: "ABCD123456",
              verificationUrl: `${origin}/cli/authorize`,
              interval: 1,
              expiresAt: 1001,
            },
          }
        : { ok: false, error: { code: "ACCESS_DENIED", message: "Denied" } },
      { status: routes.length === 1 ? 200 : 403 },
    );
  });
  try {
    await runKit(["login", "--base-url", origin, "--no-browser", "--json"]);
    assert.equal(process.exitCode, 1);
    assert.equal(JSON.parse(stdout).error.code, "EXPIRED_TOKEN");
    assert.deepEqual(routes, ["/cli/v1/auth/device"]);
  } finally {
    process.exitCode = exitCode;
  }
});

for (const [code, status] of [
  ["ACCESS_DENIED", 403],
  ["EXPIRED_TOKEN", 400],
  ["UNAUTHENTICATED", 401],
  ["INVALID_INPUT", 400],
]) {
  test(`login does not retry terminal ${code}`, async () => {
    loginPollErrors = [{ code, status }];
    const count = requests.length;
    try {
      const result = await run(["login", "--no-browser", "--json"]);
      assert.notEqual(result.status, 0);
      assert.equal(JSON.parse(result.stdout).error.code, code);
      assert.equal(
        requests.slice(count).filter((r) => r.url === "/cli/v1/auth/token")
          .length,
        1,
      );
    } finally {
      loginPollErrors = [];
    }
  });
}

test("an apply conflict exits without polling the unrelated preview", async () => {
  await saveSession(origin, tokens());
  const count = requests.length;
  syncConflict = true;
  try {
    const result = await run([
      "sync",
      "products",
      "--project",
      "p",
      "--store",
      "apple",
      "--apply",
      "--yes",
      "--wait",
      "--json",
    ]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).error.code, "INVALID_INPUT");
    assert.deepEqual(
      requests.slice(count).map((r) => r.body.command),
      ["sync products"],
    );
  } finally {
    syncConflict = false;
  }
});
