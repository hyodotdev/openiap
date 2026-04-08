#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const versionsPath = path.join(repoRoot, 'openiap-versions.json');
const targetPath = path.join(repoRoot, 'src', 'types.ts');
const releaseBase = 'https://github.com/hyodotdev/openiap/releases/download';
const assetName = 'types.ts';

async function loadRequestedTag() {
  const cliTag = process.argv[2];
  if (cliTag && cliTag.trim()) {
    return cliTag.trim();
  }

  const raw = await fs.readFile(versionsPath, 'utf8');
  const versions = JSON.parse(raw);
  if (!versions.gql) {
    throw new Error('Missing gql version in openiap-versions.json');
  }
  return versions.gql;
}

async function downloadTypes(tag) {
  const url = `${releaseBase}/${tag}/${assetName}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}

async function main() {
  const requestedTag = await loadRequestedTag();
  const candidates = requestedTag.startsWith('gql-')
    ? [requestedTag]
    : [`gql-${requestedTag}`, requestedTag];

  let resolvedTag = null;

  for (let i = 0; i < candidates.length; i += 1) {
    const tag = candidates[i];
    try {
      console.log(`Attempting to download ${assetName} from tag ${tag}...`);
      await downloadTypes(tag);
      resolvedTag = tag;
      break;
    } catch (error) {
      const hasNext = i < candidates.length - 1;
      if (hasNext) {
        console.warn(`Fallback: download failed for tag ${tag} (${error.message}). Trying ${candidates[i + 1]} next...`);
      } else {
        console.warn(`Download failed for tag ${tag}: ${error.message}`);
      }
    }
  }

  if (!resolvedTag) {
    console.error(`Unable to download ${assetName} from any candidate tag: ${candidates.join(', ')}`);
    process.exit(1);
  }

  console.log(`Updated src/types.ts from tag ${resolvedTag}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
