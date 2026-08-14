#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BUN_PROJECTS } from "./dependency-projects.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function parsePackageIdentity(resolution) {
  const separator = resolution.lastIndexOf("@");
  if (separator <= 0) return null;
  const name = resolution.slice(0, separator);
  const version = resolution.slice(separator + 1);
  if (!version || version.startsWith("workspace:")) return null;
  return { name, version };
}

export function npmPurl(name, version) {
  const packageName = name.startsWith("@")
    ? `%40${name.slice(1)}`
    : encodeURIComponent(name);
  return `pkg:npm/${packageName}@${encodeURIComponent(version)}`;
}

function dependencyEntries(metadata) {
  const entries = new Map();
  const optionalPeers = new Set(metadata?.optionalPeers ?? []);
  for (const [name, range] of Object.entries(
    metadata?.peerDependencies ?? {},
  )) {
    entries.set(name, {
      name,
      optional: optionalPeers.has(name),
      peer: true,
      range,
    });
  }
  for (const [name, range] of Object.entries(metadata?.dependencies ?? {})) {
    entries.set(name, { name, optional: false, peer: false, range });
  }
  for (const [name, range] of Object.entries(
    metadata?.optionalDependencies ?? {},
  )) {
    entries.set(name, { name, optional: true, peer: false, range });
  }
  return [...entries.values()];
}

function packageParent(packages, key) {
  let separator = key.lastIndexOf("/");
  while (separator > 0) {
    const candidate = key.slice(0, separator);
    if (packages[candidate]) return candidate;
    separator = key.lastIndexOf("/", separator - 1);
  }
  return "";
}

function resolvePackageKey(packages, originKey, dependencyName) {
  let parent = originKey;
  while (parent) {
    const candidate = `${parent}/${dependencyName}`;
    if (packages[candidate]) return candidate;
    parent = packageParent(packages, parent);
  }
  if (packages[dependencyName]) return dependencyName;
  throw new Error(
    `cannot resolve ${dependencyName} from ${originKey || "workspace root"}`,
  );
}

export function createBunManifest(lock, sourceLocation = "bun.lock") {
  const packages = lock.packages ?? {};
  const workspaces = lock.workspaces ?? {};
  const workspaceByName = new Map(
    Object.entries(workspaces)
      .filter(([, workspace]) => workspace.name)
      .map(([path, workspace]) => [workspace.name, { path, workspace }]),
  );
  const workspacePackageKeyByPath = new Map(
    Object.entries(packages).flatMap(([key, entry]) => {
      const resolution = entry?.[0] ?? "";
      const marker = resolution.lastIndexOf("@workspace:");
      return marker < 0 ? [] : [[resolution.slice(marker + 11), key]];
    }),
  );
  const direct = new Set();
  const runtime = new Set();
  const development = new Set();

  function resolveDependency(originKey, { name, optional, peer, range }) {
    if (String(range).startsWith("workspace:")) {
      const target = workspaceByName.get(name);
      if (!target)
        throw new Error(`cannot resolve workspace dependency ${name}`);
      return { kind: "workspace", key: target.path };
    }
    try {
      return {
        kind: "package",
        key: resolvePackageKey(
          packages,
          peer ? packageParent(packages, originKey) : originKey,
          name,
        ),
      };
    } catch (error) {
      if (optional) return null;
      throw error;
    }
  }

  function traverse(seeds, scope) {
    const visitedWorkspaces = new Set();
    const visitedPackages = scope === "runtime" ? runtime : development;
    const queue = [...seeds];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node.kind === "workspace") {
        if (visitedWorkspaces.has(node.key)) continue;
        visitedWorkspaces.add(node.key);
        const workspace = workspaces[node.key];
        if (!workspace) throw new Error(`missing workspace ${node.key}`);
        const originKey = workspacePackageKeyByPath.get(node.key) ?? "";
        for (const dependency of dependencyEntries(workspace)) {
          const child = resolveDependency(originKey, dependency);
          if (!child) continue;
          if (child.kind === "package") direct.add(child.key);
          queue.push(child);
        }
        continue;
      }

      if (visitedPackages.has(node.key)) continue;
      visitedPackages.add(node.key);
      const entry = packages[node.key];
      if (!entry) throw new Error(`missing Bun package entry ${node.key}`);
      for (const dependency of dependencyEntries(entry[2])) {
        const child = resolveDependency(node.key, dependency);
        if (child) queue.push(child);
      }
    }
  }

  const runtimeSeeds = [];
  const developmentSeeds = [];
  for (const [path, workspace] of Object.entries(workspaces)) {
    const originKey = workspacePackageKeyByPath.get(path) ?? "";
    for (const [name, range] of Object.entries(
      workspace.devDependencies ?? {},
    )) {
      const child = resolveDependency(originKey, {
        name,
        optional: false,
        peer: false,
        range,
      });
      if (child.kind === "package") direct.add(child.key);
      developmentSeeds.push(child);
    }
    runtimeSeeds.push({ kind: "workspace", key: path });
  }
  traverse(runtimeSeeds, "runtime");
  traverse(developmentSeeds, "development");

  const resolved = {};
  for (const key of new Set([...runtime, ...development])) {
    const identity = parsePackageIdentity(packages[key]?.[0] ?? "");
    if (!identity) continue;
    const packageUrl = npmPurl(identity.name, identity.version);
    const existing = resolved[packageUrl];
    const dependencies = dependencyEntries(packages[key][2])
      .map((dependency) => {
        const child = resolveDependency(key, dependency);
        if (!child) return null;
        if (child.kind !== "package") return null;
        const childIdentity = parsePackageIdentity(packages[child.key][0]);
        if (!childIdentity) throw new Error(`invalid package ${child.key}`);
        return npmPurl(childIdentity.name, childIdentity.version);
      })
      .filter(Boolean);
    resolved[packageUrl] = {
      package_url: packageUrl,
      relationship:
        direct.has(key) || existing?.relationship === "direct"
          ? "direct"
          : "indirect",
      scope:
        runtime.has(key) || existing?.scope === "runtime"
          ? "runtime"
          : "development",
      dependencies: [
        ...new Set([...(existing?.dependencies ?? []), ...dependencies]),
      ],
    };
  }

  const expectedPackageUrls = new Set(
    Object.values(packages)
      .map((entry) => parsePackageIdentity(entry?.[0] ?? ""))
      .filter(Boolean)
      .map(({ name, version }) => npmPurl(name, version)),
  );
  const omittedPackageUrls = [...expectedPackageUrls].filter(
    (packageUrl) => !resolved[packageUrl],
  );
  if (omittedPackageUrls.length > 0) {
    throw new Error(
      `${sourceLocation} omitted resolved packages: ${omittedPackageUrls.join(", ")}`,
    );
  }

  if (Object.keys(resolved).length === 0) {
    throw new Error(`${sourceLocation} contains no resolved npm dependencies`);
  }
  return {
    name: sourceLocation,
    file: { source_location: sourceLocation },
    resolved,
  };
}

export function createSnapshot(projects, environment, now = new Date()) {
  const required = [
    "GITHUB_SHA",
    "GITHUB_REF",
    "GITHUB_RUN_ID",
    "GITHUB_WORKFLOW",
    "GITHUB_JOB",
    "GITHUB_REPOSITORY",
  ];
  for (const name of required) {
    if (!environment[name]) throw new Error(`${name} is required`);
  }
  const manifests = Object.fromEntries(
    projects.map(({ lock, lockfile }) => [
      lockfile,
      createBunManifest(lock, lockfile),
    ]),
  );
  return {
    version: 0,
    sha: environment.GITHUB_SHA,
    ref: environment.GITHUB_REF,
    job: {
      id: environment.GITHUB_RUN_ID,
      correlator: `${environment.GITHUB_WORKFLOW} ${environment.GITHUB_JOB}`,
      html_url: `${environment.GITHUB_SERVER_URL ?? "https://github.com"}/${environment.GITHUB_REPOSITORY}/actions/runs/${environment.GITHUB_RUN_ID}`,
    },
    detector: {
      name: "openiap-bun-lock",
      version: "2.0.0",
      url: "https://github.com/hyodotdev/openiap/blob/main/scripts/bun-dependency-snapshot.mjs",
    },
    scanned: now.toISOString(),
    manifests,
  };
}

function main() {
  const projects = BUN_PROJECTS.map(({ directory, lockfile }) => ({
    directory,
    lockfile,
    lock: Bun.JSONC.parse(readFileSync(resolve(repoRoot, lockfile), "utf8")),
  }));
  process.stdout.write(
    `${JSON.stringify(createSnapshot(projects, process.env))}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
