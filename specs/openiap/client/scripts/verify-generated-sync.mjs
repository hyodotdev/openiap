import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SYNC_EDGES } from "../generated-sync-manifest.mjs";
import { materializeGeneratedSyncEdge } from "./generated-sync-materializer.mjs";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

export function collectGeneratedSyncDrift(root = repositoryRoot) {
  const sourceCache = new Map();
  const drift = [];

  for (const edge of GENERATED_SYNC_EDGES) {
    const sourcePath = resolve(root, edge.source);
    const targetPath = resolve(root, edge.path);
    if (!existsSync(sourcePath)) {
      drift.push(`${edge.source} is missing`);
      continue;
    }
    if (!existsSync(targetPath)) {
      drift.push(`${edge.path} is missing`);
      continue;
    }

    let source = sourceCache.get(edge.source);
    if (source === undefined) {
      source = readFileSync(sourcePath, "utf8");
      sourceCache.set(edge.source, source);
    }
    const expected = materializeGeneratedSyncEdge(edge, source);
    const actual = readFileSync(targetPath, "utf8");
    if (actual !== expected) {
      drift.push(
        `${edge.path} is not the ${edge.mode} materialization of ${edge.source}`,
      );
    }
  }

  return drift;
}
