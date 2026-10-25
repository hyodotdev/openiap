import { readFile, open, unlink } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { kitClient, KitError } from "./client.mjs";
import { normalizeOrigin, saveSession, removeSession } from "./session.mjs";
import { localCommands } from "./local-commands.mjs";
import { uploadFile } from "./upload.mjs";
import { commandSchema } from "./schema.mjs";
import {
  SETUP_FRAMEWORKS,
  renderSetupSnippet,
  simulatePurchaseSteps,
} from "./guides.mjs";
import { readLocalFile } from "./files.mjs";

const operations = [
  ...JSON.parse(
    await readFile(new URL("./operations.json", import.meta.url), "utf8"),
  ),
  ...localCommands,
];
const hidden = new Set([
  "apiKey",
  "sourceAuth",
  "requestIp",
  "correlationId",
  "now",
]);
const aliases = {
  project: "projectId",
  org: "organizationId",
  key: "keyId",
  "expires-in-days": "expiresInDays",
};
const special = new Set([
  "json",
  "yes",
  "apply",
  "dry-run",
  "wait",
  "no-browser",
  "help",
]);
const values = new Set([
  "base-url",
  "file",
  "limit",
  "cursor",
  "timeout",
  "credential-file",
  "path",
  "output",
]);
const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function parse(argv, operation) {
  const args = {};
  const options = {};
  const fields = operation?.args.value ?? {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith("--"))
      throw new KitError(
        "INVALID_INPUT",
        "Unexpected positional argument. Use named options or --file.",
      );
    const [flag, inline] = argument.slice(2).split(/=(.*)/s);
    if (special.has(flag)) {
      if (inline !== undefined)
        throw new KitError("INVALID_INPUT", `--${flag} does not take a value.`);
      options[camel(flag)] = true;
      continue;
    }
    const key = Object.hasOwn(aliases, flag) ? aliases[flag] : camel(flag);
    const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
    if (
      !field &&
      !values.has(flag) &&
      !["project", "org", "name", "scope"].includes(flag) &&
      !(flag === "store" && operation?.command === "sync products")
    )
      throw new KitError("INVALID_INPUT", `Unknown option: --${flag}`);
    if (hidden.has(key))
      throw new KitError(
        "INVALID_INPUT",
        `${key} is supplied by your login session.`,
      );
    const value = inline ?? argv[++index];
    if (value === undefined || value.startsWith("--"))
      throw new KitError("INVALID_INPUT", `--${flag} requires a value.`);
    if (values.has(flag) && !field) options[camel(flag)] = value;
    else if (flag === "store" && operation?.command === "sync products")
      args.platform =
        value === "apple" ? "IOS" : value === "google" ? "Android" : value;
    else args[key] = convert(value, field?.fieldType);
  }
  return { args, options };
}

function convert(value, type) {
  if (
    !type ||
    (["string", "id", "literal"].includes(type.type) &&
      typeof type.value !== "boolean" &&
      typeof type.value !== "number")
  )
    return value;
  if (
    type.type === "union" &&
    type.value.every(
      (v) =>
        ["string", "id"].includes(v.type) ||
        (v.type === "literal" && typeof v.value === "string"),
    )
  )
    return value;
  if (
    type.type === "union" &&
    type.value.some((entry) => entry.type === "string")
  ) {
    return value === "null" && type.value.some((entry) => entry.type === "null")
      ? null
      : value;
  }
  try {
    return JSON.parse(value);
  } catch {
    if (
      type.type === "union" &&
      type.value.some(
        (entry) =>
          entry.type === "string" ||
          (entry.type === "literal" && entry.value === value),
      )
    )
      return value;
    throw new KitError(
      "INVALID_INPUT",
      "Use a JSON value for numbers, booleans, arrays and objects.",
    );
  }
}

export function kitHelp(operation) {
  if (operation) {
    return `openiap kit ${operation.command} [options]\n\n${operation.effect}; ${operation.kind}\n${Object.entries(
      operation.args.value,
    )
      .filter(([name]) => !hidden.has(name))
      .map(
        ([name, field]) =>
          `  --${kebab(name)}${field.optional ? "" : " (required)"}  ${JSON.stringify(field.fieldType)}`,
      )
      .join(
        "\n",
      )}\n\nUse --project for projectId, --org for organizationId, --file for a JSON body.\nOptions: ${commandSchema(operation).options.join(" ")}\n--json returns JSON; --yes confirms destructive or publishing actions.\n`;
  }
  return `openiap kit login [--no-browser] [--scope read|write|admin]\nopeniap kit logout\nopeniap kit schema [command] --json\n\n${operations.map((op) => `  ${op.command}`).join("\n")}\n\nAll commands accept --base-url and --json. Use --help on a command.\nIAPKIT_TOKEN supplies an automation token. Credentials are stored per origin.\n`;
}

async function readInput(file) {
  const text =
    file === "-"
      ? await readStdin()
      : (await readLocalFile(file, 512 * 1024)).toString("utf8");
  if (Buffer.byteLength(text) > 512 * 1024)
    throw new KitError(
      "INPUT_TOO_LARGE",
      "JSON input must be at most 512 KiB.",
    );
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new KitError("INVALID_INPUT", "--file must contain a JSON object.");
  }
  if (!input || Array.isArray(input) || typeof input !== "object")
    throw new KitError("INVALID_INPUT", "--file must contain a JSON object.");
  return input;
}

async function readStdin() {
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
    if (Buffer.byteLength(text) > 512 * 1024)
      throw new KitError("INPUT_TOO_LARGE", "Input must be at most 512 KiB.");
  }
  return text;
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

async function login(client, origin, args, options) {
  const device = await client.request("/auth/device", {
    name: args.name ?? hostname(),
    scope: args.scope ?? "admin",
  });
  process.stderr.write(
    `Open ${device.verificationUrl}\nConfirm this code: ${device.userCode}\nWaiting for approval…\n`,
  );
  if (!options.noBrowser) openBrowser(device.verificationUrl);
  let interval = device.interval * 1000;
  while (Date.now() < device.expiresAt) {
    await delay(Math.min(interval, device.expiresAt - Date.now()));
    if (Date.now() >= device.expiresAt) break;
    try {
      const tokens = await client.request("/auth/token", {
        deviceCode: device.deviceCode,
      });
      await saveSession(origin, tokens);
      return { loggedIn: true, origin };
    } catch (error) {
      if (error.code === "AUTHORIZATION_PENDING") continue;
      if (error.code === "RATE_LIMITED") {
        interval += 5000;
        continue;
      }
      if (
        error.code === "NETWORK_ERROR" ||
        (error.status >= 500 && error.status < 600)
      ) {
        interval = Math.min(Math.max(interval * 2, 1000), 30_000);
        continue;
      }
      throw error;
    }
  }
  throw new KitError(
    "EXPIRED_TOKEN",
    "Login code expired. Run openiap kit login again.",
  );
}

function matchesSchema(value, schema) {
  if (Object.hasOwn(schema, "const")) return value === schema.const;
  if (schema.anyOf)
    return schema.anyOf.some((option) => matchesSchema(value, option));
  if (schema.type === "array")
    return (
      Array.isArray(value) &&
      value.every((item) => matchesSchema(item, schema.items))
    );
  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return false;
    if (schema.required?.some((key) => !Object.hasOwn(value, key)))
      return false;
    return Object.entries(value).every(([key, item]) => {
      const field = Object.hasOwn(schema.properties ?? {}, key)
        ? schema.properties[key]
        : schema.additionalProperties;
      return field === undefined || field === true
        ? true
        : field !== false && matchesSchema(item, field);
    });
  }
  if (schema.type === "null") return value === null;
  if (schema.type === "number")
    return typeof value === "number" && Number.isFinite(value);
  return !schema.type || typeof value === schema.type;
}

function validate(operation, args) {
  const schema = commandSchema(operation).inputSchema;
  for (const name of schema.required) {
    if (args[name] === undefined)
      throw new KitError(
        "INVALID_INPUT",
        `Missing --${kebab(name)}. Use --help for the input schema.`,
      );
  }
  for (const key of Object.keys(args)) {
    if (hidden.has(key))
      throw new KitError("INVALID_INPUT", `Reserved input field: ${key}`);
    const field = Object.hasOwn(schema.properties, key)
      ? schema.properties[key]
      : undefined;
    if (!field)
      throw new KitError("INVALID_INPUT", `Unknown input field: ${key}`);
    if (!matchesSchema(args[key], field)) {
      const expected = field.anyOf?.every((option) =>
        Object.hasOwn(option, "const"),
      )
        ? field.anyOf.map((option) => JSON.stringify(option.const)).join(" | ")
        : (field.type ?? "a value matching the input schema");
      throw new KitError(
        "INVALID_INPUT",
        `Invalid --${kebab(key)}. Expected ${expected}. Use --help for the input schema.`,
      );
    }
  }
}

export async function runKit(argv) {
  const json = argv.includes("--json");
  let output;
  let outputPath;
  let outputWritten = false;
  try {
    const words = argv.slice(
      0,
      argv.findIndex((arg) => arg.startsWith("--")) < 0
        ? argv.length
        : argv.findIndex((arg) => arg.startsWith("--")),
    );
    const command = words.join(" ");
    const operation = operations.find((entry) => entry.command === command);
    if (!argv.length || argv.includes("--help")) {
      process.stdout.write(kitHelp(operation));
      return;
    }
    if (words[0] === "schema") {
      const name = words.slice(1).join(" ");
      const schema = name
        ? operations.find((entry) => entry.command === name)
        : operations;
      if (!schema)
        throw new KitError("UNKNOWN_COMMAND", "Unknown command schema.");
      parse(argv.slice(words.length));
      process.stdout.write(
        `${JSON.stringify({ ok: true, data: Array.isArray(schema) ? schema.map(commandSchema) : commandSchema(schema) }, null, 2)}\n`,
      );
      return;
    }
    if (!["login", "logout"].includes(command) && !operation)
      throw new KitError(
        "UNKNOWN_COMMAND",
        "Use openiap kit --help to find a command.",
      );
    const { args: flags, options } = parse(argv.slice(words.length), operation);
    let args = {
      ...(options.file ? await readInput(options.file) : {}),
      ...flags,
    };
    if (options.wait && command !== "sync products")
      throw new KitError(
        "INVALID_INPUT",
        "--wait is supported by sync products.",
      );
    if ((options.apply || options.dryRun) && command !== "sync products")
      throw new KitError(
        "INVALID_INPUT",
        "--apply and --dry-run are supported by sync products.",
      );
    const timeout = Number(options.timeout ?? 120);
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new KitError(
        "INVALID_INPUT",
        "--timeout must be a positive number of seconds.",
      );
    if (options.output) {
      outputPath = options.output;
      output = await open(outputPath, "wx", 0o600);
    }
    const origin = normalizeOrigin(
      options.baseUrl ?? process.env.IAPKIT_BASE_URL,
    );
    const client = kitClient(origin);
    let data;
    if (command === "login") data = await login(client, origin, args, options);
    else if (command === "logout") {
      if (process.env.IAPKIT_TOKEN && !options.yes)
        throw new KitError(
          "CONFIRMATION_REQUIRED",
          "IAPKIT_TOKEN is set. Pass --yes to revoke that automation token; the saved browser login will remain.",
        );
      try {
        await client.run("logout", {}, options.yes === true);
      } finally {
        if (!process.env.IAPKIT_TOKEN) await removeSession(origin);
      }
      data = { loggedOut: true, origin };
    } else {
      if (command === "credentials apple" && options.credentialFile) {
        args.content = (
          await readLocalFile(options.credentialFile, 10 * 1024)
        ).toString("utf8");
        args.fileName = path.basename(options.credentialFile);
        args.fileType = "application/x-pem-file";
      }
      if ("paginationOpts" in operation.args.value) {
        args.paginationOpts ??= {
          numItems: Number(options.limit ?? 25),
          cursor: options.cursor ?? null,
        };
      }
      if (command === "sync products") {
        args.dryRun = !options.apply;
        if (options.apply && options.dryRun)
          throw new KitError("INVALID_INPUT", "Choose --apply or --dry-run.");
      }
      if (operation.kind === "local") {
        validate(operation, args);
        data = await runLocal(command, client, origin, args, options);
      } else if (command === "projects list" && !args.organizationId) {
        validate(operation, {
          ...args,
          organizationId: "all-accessible-organizations",
        });
        const orgs = await client.run("orgs list");
        data = (
          await Promise.all(
            orgs.map((org) => client.run(command, { organizationId: org._id })),
          )
        ).flat();
      } else {
        validate(operation, args);
        if (
          (operation.effect.includes("destructive") ||
            operation.effect === "publish" ||
            options.apply) &&
          !options.yes
        )
          throw new KitError(
            "CONFIRMATION_REQUIRED",
            "Pass --yes to apply this command.",
          );
        data = await client.run(command, args, options.yes === true);
      }
      if (data?.success === false)
        throw new KitError(
          data.code ?? "OPERATION_FAILED",
          data.message ?? "The operation did not succeed.",
        );
      if (options.wait) {
        const id = data.jobId ?? data._id;
        if (!id)
          throw new KitError(
            "INVALID_RESPONSE",
            "The sync response did not contain a job ID.",
          );
        const deadline = Date.now() + timeout * 1000;
        do {
          data = await client.run("sync status", {
            projectId: args.projectId,
            jobId: id,
          });
          if (["succeeded", "failed", "cancelled"].includes(data.status)) break;
          await delay(2000);
        } while (Date.now() < deadline);
        if (!["succeeded", "failed", "cancelled"].includes(data.status))
          throw new KitError(
            "WAIT_TIMEOUT",
            `Job ${id} is still running. Use sync status.`,
            { jobId: id },
          );
        if (data.status !== "succeeded")
          throw new KitError("JOB_FAILED", `Sync job ${id} ${data.status}.`, {
            jobId: id,
          });
      }
    }
    if (output) {
      const bytes =
        command === "credentials download"
          ? Buffer.from(data.base64, "base64")
          : `${JSON.stringify(data, null, 2)}\n`;
      try {
        await output.writeFile(bytes);
        outputWritten = true;
        data = { saved: true, path: path.resolve(outputPath) };
      } catch {
        process.stderr.write(
          "The output file could not be written. Returning the result on stdout so a one-time secret is not lost.\n",
        );
      }
    }
    process.stdout.write(
      `${JSON.stringify(json ? { ok: true, data } : data, null, 2)}\n`,
    );
  } catch (error) {
    const code = error.code ?? "CLI_ERROR";
    const message = ["ENOENT", "EACCES"].includes(code)
      ? "The input or credential file could not be read."
      : error.message;
    const result = {
      ok: false,
      error: { code, message, ...(error.jobId ? { jobId: error.jobId } : {}) },
    };
    if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = [
      "UNAUTHENTICATED",
      "SESSION_EXPIRED",
      "INVALID_SESSION",
    ].includes(code)
      ? 3
      : [
            "INSUFFICIENT_SCOPE",
            "INSUFFICIENT_PERMISSIONS",
            "NOT_ORGANIZATION_MEMBER",
            "NOT_AUTHORIZED",
          ].includes(code)
        ? 4
        : 1;
  } finally {
    await output?.close();
    if (output && !outputWritten) await unlink(outputPath).catch(() => {});
  }
}

async function runLocal(command, client, origin, args, options) {
  if (command === "health") return client.health();
  if (command === "setup") {
    if (!SETUP_FRAMEWORKS.includes(args.framework))
      throw new KitError(
        "INVALID_INPUT",
        `framework must be ${SETUP_FRAMEWORKS.join(", ")}.`,
      );
    return {
      framework: args.framework,
      snippet: renderSetupSnippet(
        args.framework,
        "<IAPKIT_PUBLISHABLE_KEY>",
        args.productId ?? "com.example.premium_monthly",
      ),
      note: "Insert a publishable openiap-kit_pk_ key. Never put a secret key or CLI token in an app.",
    };
  }
  if (command === "files upload" || command === "credentials google") {
    return uploadFile(
      client,
      args,
      args.path ??
        args.credentialFile ??
        options.path ??
        options.credentialFile,
      command === "credentials google"
        ? "android_service_account"
        : args.purpose,
    );
  }
  if (command === "troubleshoot") {
    const session = await client.run("whoami");
    const setup = await client.run("setup status", {
      projectId: args.projectId,
    });
    return { session, setup };
  }
  if (command === "inspect") {
    const [metrics, products, webhooks] = await Promise.all([
      client.run("analytics metrics", { projectId: args.projectId }),
      client.run("products list", { projectId: args.projectId, limit: 25 }),
      client.run("webhooks endpoints", { projectId: args.projectId }),
    ]);
    return { metrics, products, webhooks };
  }
  if (command === "simulate purchase") {
    if (args.platform !== "IOS" && args.platform !== "Android")
      throw new KitError("INVALID_INPUT", "platform must be IOS or Android.");
    return { steps: simulatePurchaseSteps(args) };
  }
  if (args.platform === "IOS")
    return {
      instructions:
        "Use App Store Connect → App Store Server Notifications → Send Test Notification. Apple notifications require a real signed sandbox payload.",
    };
  if (args.platform !== "Android")
    throw new KitError("INVALID_INPUT", "platform must be IOS or Android.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname))
    throw new KitError(
      "LOCAL_ONLY",
      "Synthetic Google webhooks are only sent to a local development instance.",
    );
  const endpoints = await client.run("webhooks endpoints", {
    projectId: args.projectId,
  });
  if (!endpoints?.unified)
    throw new KitError(
      "NOT_CONFIGURED",
      "Configure an active publishable key for this project.",
    );
  const payload = {
    message: {
      data: Buffer.from(
        JSON.stringify({
          version: "1.0",
          packageName: "com.example.app",
          eventTimeMillis: Date.now(),
          testNotification: { version: "1.0" },
        }),
      ).toString("base64"),
      messageId: `test-${Date.now()}`,
      publishTime: new Date().toISOString(),
    },
    subscription: "projects/local/subscriptions/openiap-test",
  };
  const response = await fetch(new URL(endpoints.unified, origin), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new KitError(
      "SIMULATION_FAILED",
      `Local webhook returned HTTP ${response.status}. Check KIT_ALLOW_UNAUTHENTICATED_PUBSUB.`,
    );
  return { sent: true, status: response.status };
}
