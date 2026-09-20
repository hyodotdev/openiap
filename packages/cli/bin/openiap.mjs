#!/usr/bin/env node
import path from "node:path";
import { readFileSync } from "node:fs";
import { doctor, formatText } from "../src/doctor.mjs";
import { chooseRole, implementationBrief } from "../src/init.mjs";

const USAGE = `openiap                         choose your role and get an AI implementation brief
openiap init [path] [--role app|experience|commerce|data]
openiap doctor [path] [--json]

Start an integration with init; check local configuration with doctor.
Both read local files without modifying them or contacting a server.

  path       project root (default: the working directory)
  --role     your product's role (init only; prompts in a terminal if omitted)
  --json     one machine-readable report (doctor only)
  --help     show this help (-h)
  --version  print the version and exit (-v)
`;

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw error;
});

const argv = process.argv.slice(2);
const beforeSeparator = argv.slice(
  0,
  argv.indexOf("--") < 0 ? undefined : argv.indexOf("--"),
);
if (beforeSeparator.includes("--version") || beforeSeparator.includes("-v")) {
  const manifest = new URL("../package.json", import.meta.url);
  process.stdout.write(
    `${JSON.parse(readFileSync(manifest, "utf8")).version}\n`,
  );
  process.exit(0);
}

if (
  beforeSeparator.includes("--help") ||
  beforeSeparator.includes("-h") ||
  (argv.length === 0 && !process.stdin.isTTY)
) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const command = argv[0] ?? "init";
if (command !== "doctor" && command !== "init") {
  process.stderr.write(`Unknown command: ${argv[0]}\n\n${USAGE}`);
  process.exit(1);
}

// Everything after `--` is a path, so a directory named `-x` is reachable.
const end = argv.indexOf("--");
const head = end < 0 ? argv.slice(1) : argv.slice(1, end);
const tail = end < 0 ? [] : argv.slice(end + 1);

let role;
let json = false;
const positional = [];
for (let index = 0; index < head.length; index += 1) {
  const argument = head[index];
  if (command === "doctor" && argument === "--json") json = true;
  else if (
    command === "init" &&
    (argument === "--role" || argument.startsWith("--role="))
  ) {
    const value =
      argument === "--role" ? head[++index] : argument.slice("--role=".length);
    if (role !== undefined || !value || value.startsWith("-")) {
      process.stderr.write(
        "Expected one --role value: app, experience, commerce, or data.\n",
      );
      process.exit(1);
    }
    role = value;
  } else if (argument.startsWith("-")) {
    process.stderr.write(`Unknown option: ${argument}\n\n${USAGE}`);
    process.exit(1);
  } else positional.push(argument);
}

positional.push(...tail);
if (positional.length > 1) {
  process.stderr.write(
    `Expected one path, got ${positional.length}: ${positional.join(" ")}\n\n${USAGE}`,
  );
  process.exit(1);
}

const root = path.resolve(positional[0] ?? process.cwd());

if (command === "init") {
  try {
    process.stdout.write(
      implementationBrief(root, role ?? (await chooseRole())),
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
} else {
  const result = doctor(root);
  // Set the code and let the write finish; `process.exit` would cut it short.
  process.exitCode = result.errors > 0 ? 1 : 0;
  process.stdout.write(
    json ? `${JSON.stringify(result, null, 2)}\n` : `${formatText(result)}\n`,
  );
}
