#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_SYNC_EDGES } from "../generated-sync-manifest.mjs";
import { materializeGeneratedSyncEdge } from "./generated-sync-materializer.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDirectory, "../../../..");
const fromRoot = (path) => resolve(monorepoRoot, path);

for (const source of new Set(GENERATED_SYNC_EDGES.map((edge) => edge.source))) {
  if (!existsSync(fromRoot(source))) {
    throw new Error(`Canonical sync source not found: ${fromRoot(source)}`);
  }
}

console.log("📦 Syncing generated sources to platforms...\n");

for (const edge of GENERATED_SYNC_EDGES) {
  const source = fromRoot(edge.source);
  const destination = fromRoot(edge.path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    materializeGeneratedSyncEdge(edge, readFileSync(source, "utf8")),
  );

  console.log(`✅ ${edge.label}`);
  console.log(`   ${destination}\n`);
}

console.log("🎉 Platform sync complete!\n");
