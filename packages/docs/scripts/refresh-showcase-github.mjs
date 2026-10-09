#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const dataPath = new URL('../showcase-apps.json', import.meta.url);
const repositoryUrl = 'https://github.com/hyodotdev/openiap';

async function fetchPage(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`GitHub returned ${response.status}: ${url}`);
  return response.text();
}

const data = JSON.parse(await readFile(dataPath, 'utf8'));
const index = await fetchPage(`${repositoryUrl}/network/dependents`);
const sources = [
  ...index.matchAll(
    /<a\s+href="([^"]+)"\s+class="select-menu-item"[\s\S]*?<span class="select-menu-item-text">\s*([^<]+?)\s*<\/span>/g
  ),
]
  .map((match) => ({
    package: match[2].trim(),
    url: new URL(match[1].replaceAll('&amp;', '&'), repositoryUrl).href,
  }))
  .filter((source) => !data.github.excludedPackages.includes(source.package));

if (!sources.length) throw new Error('GitHub did not list any packages');
for (const previous of data.github.sources) {
  if (!sources.some((source) => source.package === previous.package)) {
    throw new Error(
      `GitHub did not list ${previous.package}; keeping the snapshot`
    );
  }
}

const repositories = new Map();
for (const source of sources) {
  const visited = new Set();
  let url = source.url;
  while (url) {
    if (visited.has(url))
      throw new Error(`Repeated pagination for ${source.package}`);
    visited.add(url);
    const html = await fetchPage(url);
    const count = html
      .replace(/<[^>]+>/g, ' ')
      .match(/([\d,]+)\s+Repositories/)?.[1];
    if (count === undefined)
      throw new Error(`Missing count for ${source.package}`);
    source.dependents ??= Number(count.replaceAll(',', ''));

    const rows = html.split('data-test-id="dg-repo-pkg-dependent"').slice(1);
    if (!rows.length && source.dependents > 0) {
      throw new Error(`Missing dependent rows for ${source.package}`);
    }
    for (const row of rows) {
      const name = row.match(
        /data-hovercard-type="repository"[^>]*href="\/([^"?]+)"/
      )?.[1];
      const stars = row.match(
        /class="octicon octicon-star">[\s\S]*?<\/svg>\s*([\d,]+)/
      )?.[1];
      if (!name || stars === undefined) {
        throw new Error(`Cannot read a dependent row for ${source.package}`);
      }
      const key = name.toLowerCase();
      const entry = repositories.get(key) ?? { name, stars: 0, packages: [] };
      entry.stars = Math.max(entry.stars, Number(stars.replaceAll(',', '')));
      if (!entry.packages.includes(source.package))
        entry.packages.push(source.package);
      repositories.set(key, entry);
    }
    url = html
      .match(/<a\b[^>]*href="([^"]+)"[^>]*>Next<\/a>/)?.[1]
      .replaceAll('&amp;', '&');
    if (url && !url.startsWith(`${repositoryUrl}/network/dependents?`)) {
      throw new Error(`Unexpected pagination URL: ${url}`);
    }
  }
  console.log(`${source.package}: ${source.dependents} reported dependents`);
}

data.github = {
  ...data.github,
  checkedAt: new Date().toISOString().slice(0, 10),
  sources: sources.sort((a, b) => a.package.localeCompare(b.package)),
  repositories: [...repositories.values()]
    .map((entry) => ({
      ...entry,
      packages: entry.packages
        .filter((name) => data.github.showcasePackages.includes(name))
        .sort(),
    }))
    .filter(
      (entry) =>
        entry.stars >= data.github.minimumStars && entry.packages.length > 0
    )
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name)),
};

for (const app of data.github.apps) {
  if (
    !data.github.repositories.some(
      (entry) => entry.name.toLowerCase() === app.repository.toLowerCase()
    )
  ) {
    throw new Error(
      `Missing curated app ${app.repository}; review before refreshing`
    );
  }
}

const nextData = await format(JSON.stringify(data), { parser: 'json' });
await writeFile(dataPath, nextData);
console.log(
  `Saved ${data.github.repositories.length} projects with ${data.github.minimumStars}+ stars`
);
