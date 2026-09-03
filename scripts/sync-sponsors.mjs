#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");
const registryPath = "packages/docs/sponsor-registry.json";

export const sponsorBlockStart = "<!-- sponsors:start -->";
export const sponsorBlockEnd = "<!-- sponsors:end -->";

function readSponsorFile(root, relative, staged) {
  if (!staged) {
    return fs.readFileSync(path.join(root, relative), "utf8");
  }

  try {
    return execFileSync("git", ["show", `:${relative}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new Error(`${relative}: file is missing from the Git index`, {
      cause: error,
    });
  }
}

function sponsorAssetExists(root, assetPath, staged) {
  const relative = `packages/docs/public/${assetPath.slice(1)}`;

  if (!staged) {
    return fs.existsSync(path.join(root, relative));
  }

  try {
    execFileSync("git", ["cat-file", "-e", `:${relative}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function readRegistry(root, staged) {
  return JSON.parse(readSponsorFile(root, registryPath, staged));
}

function requireUrl(value, label, protocols = ["https:"]) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${label} must use ${protocols.join(" or ")}`);
  }
}

function validateLogo(root, logo, label, staged) {
  if (!Number.isInteger(logo?.height) || logo.height <= 0) {
    throw new Error(`${label}.height must be a positive integer`);
  }

  for (const field of ["src", "darkSrc"]) {
    const asset = logo[field];
    if (field === "darkSrc" && asset === undefined) {
      continue;
    }
    if (typeof asset !== "string" || !asset.startsWith("/")) {
      throw new Error(`${label}.${field} must be a root-relative path`);
    }
    if (!sponsorAssetExists(root, asset, staged)) {
      throw new Error(`${label}.${field} does not exist: ${asset}`);
    }
  }
}

export function validateRegistry(root, registry, { staged = false } = {}) {
  if (
    !Array.isArray(registry.currentSponsors) ||
    registry.currentSponsors.length === 0
  ) {
    throw new Error("currentSponsors must contain at least one sponsor");
  }

  if (!Array.isArray(registry.pastSupporters)) {
    throw new Error("pastSupporters must be an array");
  }

  const ids = new Set();
  for (const [group, entries] of [
    ["currentSponsors", registry.currentSponsors],
    ["pastSupporters", registry.pastSupporters],
  ]) {
    for (const entry of entries) {
      const label = `${group}.${entry.id ?? "unknown"}`;

      if (!/^[a-z0-9-]+$/u.test(entry.id ?? "")) {
        throw new Error(`${label}.id must be lowercase kebab-case`);
      }
      if (ids.has(entry.id)) {
        throw new Error(`duplicate supporter id: ${entry.id}`);
      }
      ids.add(entry.id);

      for (const field of [
        "name",
        ...(group === "currentSponsors" ? ["shortName", "tier"] : []),
      ]) {
        if (typeof entry[field] !== "string" || entry[field].trim() === "") {
          throw new Error(`${label}.${field} must be a non-empty string`);
        }
      }

      requireUrl(entry.url, `${label}.url`);

      validateLogo(root, entry.logo, `${label}.logo`, staged);
      if (entry.logo.readme !== undefined) {
        validateLogo(root, entry.logo.readme, `${label}.logo.readme`, staged);
      }
    }
  }

  const funding = registry.funding;
  if (!funding || typeof funding !== "object") {
    throw new Error("funding must be an object");
  }

  for (const field of ["sponsorsPage", "paypalUrl"]) {
    requireUrl(funding[field], `funding.${field}`);
  }
  for (const field of [
    "githubHandle",
    "openCollectiveSlug",
    "openCollectiveImageCache",
    "companyContactEmail",
  ]) {
    if (typeof funding[field] !== "string" || funding[field].trim() === "") {
      throw new Error(`funding.${field} must be a non-empty string`);
    }
  }

  for (const field of ["githubHandle", "openCollectiveSlug"]) {
    if (!/^[a-z0-9-]+$/iu.test(funding[field])) {
      throw new Error(`funding.${field} must be an account name`);
    }
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(funding.companyContactEmail)) {
    throw new Error("funding.companyContactEmail must be an email address");
  }
}

export function resolveFundingLinks(funding) {
  const githubUrl = `https://github.com/sponsors/${funding.githubHandle}`;
  const openCollectiveUrl = `https://opencollective.com/${funding.openCollectiveSlug}`;

  return {
    ...funding,
    companyContactUrl: `mailto:${funding.companyContactEmail}`,
    githubUrl,
    openCollectiveUrl,
    openCollectiveSponsorsUrl: `${openCollectiveUrl}#sponsors`,
    openCollectiveBackersUrl: `${openCollectiveUrl}#backers`,
    openCollectiveSponsorUrl: `${openCollectiveUrl}#sponsor`,
    openCollectiveBackerUrl: `${openCollectiveUrl}#backer`,
  };
}

function absoluteAssetUrl(assetPath) {
  return `https://openiap.dev${assetPath}`;
}

function repositoryAssetUrl(assetPath) {
  return `packages/docs/public${assetPath}`;
}

function renderLogo(entry, { repositoryAssets = false } = {}) {
  const logo = entry.logo.readme ?? entry.logo;
  const assetUrl = repositoryAssets ? repositoryAssetUrl : absoluteAssetUrl;

  if (!logo.darkSrc) {
    return [
      `  <a href="${entry.url}">`,
      `    <img src="${assetUrl(logo.src)}" alt="${entry.name}" height="${logo.height}" align="middle">`,
      "  </a>",
    ].join("\n");
  }

  return [
    `  <a href="${entry.url}">`,
    "    <picture>",
    `      <source media="(prefers-color-scheme: dark)" srcset="${assetUrl(logo.darkSrc)}">`,
    `      <img src="${assetUrl(logo.src)}" alt="${entry.name}" height="${logo.height}" align="middle">`,
    "    </picture>",
    "  </a>",
  ].join("\n");
}

function renderSupporterLogo(entry) {
  return [
    `  <a href="${entry.url}">`,
    `    <img src="${absoluteAssetUrl(entry.logo.src)}" alt="${entry.name}" height="${entry.logo.height}" align="middle">`,
    "  </a>",
  ].join("\n");
}

export function renderSponsorBlock(
  registry,
  { repositoryAssets = false } = {},
) {
  const { currentSponsors, pastSupporters } = registry;
  const funding = resolveFundingLinks(registry.funding);
  const currentSponsorLinks = currentSponsors.map(
    (sponsor) => `[${sponsor.name}](${sponsor.url})`,
  );
  const currentSponsorList = new Intl.ListFormat("en", {
    style: "long",
    type: "conjunction",
  }).format(currentSponsorLinks);
  const currentLogos = currentSponsors
    .map((sponsor) => renderLogo(sponsor, { repositoryAssets }))
    .join("\n  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\n");
  const pastLogos = pastSupporters
    .map(renderSupporterLogo)
    .join("\n  &nbsp;&nbsp;&nbsp;&nbsp;\n");
  const collectiveSponsorsImage = `${funding.openCollectiveUrl}/sponsors.svg?width=890&cache=${funding.openCollectiveImageCache}`;
  const collectiveBackersImage = `${funding.openCollectiveUrl}/backers.svg?width=890&cache=${funding.openCollectiveImageCache}`;

  return [
    sponsorBlockStart,
    `<!-- Generated by scripts/sync-sponsors.mjs from ${registryPath}. -->`,
    // Blank lines around the HTML comments keep the block Prettier-stable, so
    // a formatter pass over a README cannot drift it from generator output.
    "",
    "## Sponsors",
    "",
    '<p align="center">',
    currentLogos,
    "</p>",
    "",
    `Thank you to ${currentSponsorList} for supporting OpenIAP. [View sponsorship options](${funding.sponsorsPage}).`,
    "",
    "### OpenCollective",
    "",
    "We also recognize sponsors and backers through OpenCollective. The original react-native-iap collective now supports the broader OpenIAP ecosystem and is managed separately from the main sponsor program.",
    "",
    `**Sponsors:** <a href="${funding.openCollectiveSponsorsUrl}"><img src="${collectiveSponsorsImage}" alt="OpenCollective sponsors" /></a>`,
    "",
    `**Backers:** <a href="${funding.openCollectiveBackersUrl}"><img src="${collectiveBackersImage}" alt="OpenCollective backers" /></a>`,
    "",
    `[Become a sponsor](${funding.openCollectiveSponsorUrl}) | [Become a backer](${funding.openCollectiveBackerUrl})`,
    "",
    "### Past supporters",
    "",
    "Supported the project before the OpenIAP sponsor program.",
    "",
    '<p align="center">',
    pastLogos,
    "</p>",
    "",
    `[openiap-sponsors]: ${funding.sponsorsPage}`,
    `[openiap-github-sponsors]: ${funding.githubUrl}`,
    `[openiap-opencollective]: ${funding.openCollectiveUrl}`,
    `[openiap-paypal]: ${funding.paypalUrl}`,
    `[openiap-company-contact]: ${funding.companyContactUrl}`,
    "",
    sponsorBlockEnd,
  ].join("\n");
}

const unmanagedHeading = /^## (?:.* )?(?:Sponsors|Supporters)\s*$/imu;

function assertNeutralReadme(readme) {
  if (unmanagedHeading.test(readme)) {
    throw new Error(
      "unmanaged sponsor/supporter heading found; add generated block markers before syncing",
    );
  }
  return readme;
}

function assertNoUnmanagedFundingLinks(readme, funding) {
  const start = readme.indexOf(sponsorBlockStart);
  const remainder =
    start === -1
      ? readme
      : `${readme.slice(0, start)}${readme.slice(
          readme.indexOf(sponsorBlockEnd, start) + sponsorBlockEnd.length,
        )}`;
  const legacyManagedUrls = [
    /https:\/\/github\.com\/sponsors(?:\/[^\s)"'>]*)?/u,
    /https:\/\/opencollective\.com\/openiap(?:[^\s)"'>]*)?/u,
    /https:\/\/openiap\.dev\/sponsors(?:[^\s)"'>]*)?/u,
    /https:\/\/(?:www\.)?paypal\.me\/dooboolab(?:[^\s)"'>]*)?/u,
    /mailto:hyo@hyo\.dev/u,
  ];
  const managedUrls = [
    funding.sponsorsPage,
    funding.githubUrl,
    funding.openCollectiveUrl,
    funding.paypalUrl,
    funding.companyContactUrl,
  ];

  if (
    legacyManagedUrls.some((pattern) => pattern.test(remainder)) ||
    managedUrls.some((url) => remainder.includes(url))
  ) {
    throw new Error(
      "funding link found outside generated block; use an openiap-* reference",
    );
  }
}

export function synchronizeReadme(readme, sponsorBlock) {
  const startCount = readme.split(sponsorBlockStart).length - 1;
  const endCount = readme.split(sponsorBlockEnd).length - 1;

  if (startCount !== endCount || startCount > 1) {
    throw new Error("expected exactly one complete generated sponsor block");
  }

  if (startCount === 1) {
    const start = readme.indexOf(sponsorBlockStart);
    const endStart = readme.indexOf(
      sponsorBlockEnd,
      start + sponsorBlockStart.length,
    );

    if (endStart === -1) {
      throw new Error("generated sponsor block markers are out of order");
    }

    const end = endStart + sponsorBlockEnd.length;
    const remainder = `${readme.slice(0, start)}${readme.slice(end)}`;

    if (unmanagedHeading.test(remainder)) {
      throw new Error(
        "unmanaged sponsor/supporter heading found outside generated block",
      );
    }

    return `${readme.slice(0, start)}${sponsorBlock}${readme.slice(end)}`;
  }

  assertNeutralReadme(readme);

  const license = /^## (?:📄 )?License\s*$/mu.exec(readme);
  const insertion = license?.index ?? readme.trimEnd().length;
  const before = readme.slice(0, insertion).trimEnd();
  const after = readme.slice(insertion).trimStart();

  return `${before}\n\n${sponsorBlock}\n${after ? `\n${after}` : ""}`;
}

export function renderFundingConfig(registry) {
  const { funding } = registry;

  return [
    `# Generated by scripts/sync-sponsors.mjs from ${registryPath}.`,
    "# Run `bun run sponsors:sync` instead of editing this file.",
    `github: ${funding.githubHandle}`,
    `open_collective: ${funding.openCollectiveSlug}`,
    `custom: ['${funding.paypalUrl}']`,
    "",
  ].join("\n");
}

// Packages and libraries receive the generated block automatically. A
// specification README receives it only after opting in with the block
// markers; until then it is still audited so it cannot grow an unmanaged
// sponsor section or a hardcoded funding link. The Commerce Protocol README
// must stay marker-free (specs/commerce-protocol/test/decentralization.test.mjs).
const specificationOwner = "specs";
const receivesSponsorBlock = (relative, readme) =>
  !relative.startsWith(`${specificationOwner}/`) ||
  readme.includes(sponsorBlockStart);

export function discoverReadmes(
  root = repositoryRoot,
  { staged = false } = {},
) {
  if (staged) {
    return execFileSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--",
        "README.md",
        "packages",
        "libraries",
        "specs",
      ],
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(
        (relative) =>
          relative === "README.md" ||
          /^(?:packages|libraries|specs)\/[^/]+\/README\.md$/u.test(
            relative,
          ),
      )
      .sort();
  }

  const readmes = ["README.md"];

  for (const owner of ["packages", "libraries", specificationOwner]) {
    const ownerRoot = path.join(root, owner);
    if (!fs.existsSync(ownerRoot)) {
      continue;
    }
    for (const entry of fs.readdirSync(ownerRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const relative = `${owner}/${entry.name}/README.md`;
      if (fs.existsSync(path.join(root, relative))) {
        readmes.push(relative);
      }
    }
  }

  return readmes.sort();
}

export function synchronizeSponsorFiles(
  root = repositoryRoot,
  { write = false, staged = false } = {},
) {
  if (write && staged) {
    throw new Error("cannot write staged sponsor surfaces");
  }

  const registry = readRegistry(root, staged);
  validateRegistry(root, registry, { staged });
  const funding = resolveFundingLinks(registry.funding);
  const changes = [];

  for (const relative of discoverReadmes(root, { staged })) {
    const file = path.join(root, relative);
    const actual = readSponsorFile(root, relative, staged);
    const sponsorBlock = renderSponsorBlock(registry, {
      repositoryAssets: relative === "README.md",
    });
    let expected;

    try {
      expected = receivesSponsorBlock(relative, actual)
        ? synchronizeReadme(actual, sponsorBlock)
        : assertNeutralReadme(actual);
      assertNoUnmanagedFundingLinks(expected, funding);
    } catch (error) {
      if (write) {
        throw new Error(`${relative}: ${error.message}`, { cause: error });
      }

      changes.push(`${relative}: ${error.message}`);
      continue;
    }

    if (actual !== expected) {
      changes.push(relative);
      if (write) {
        fs.writeFileSync(file, expected);
      }
    }
  }

  const fundingFile = path.join(root, ".github/FUNDING.yml");
  const expectedFunding = renderFundingConfig(registry);
  if (
    readSponsorFile(root, ".github/FUNDING.yml", staged) !== expectedFunding
  ) {
    changes.push(".github/FUNDING.yml");
    if (write) {
      fs.writeFileSync(fundingFile, expectedFunding);
    }
  }

  return changes;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const write = process.argv.includes("--write");
  const staged = process.argv.includes("--staged");
  const changes = synchronizeSponsorFiles(repositoryRoot, { write, staged });

  if (write) {
    console.log(
      changes.length === 0
        ? "Sponsor surfaces already synchronized."
        : `Synchronized sponsor surfaces:\n${changes.map((file) => `- ${file}`).join("\n")}`,
    );
  } else if (changes.length === 0) {
    console.log("Sponsor surface audit: clean.");
  } else {
    console.error("Sponsor surface audit failed. Run `bun run sponsors:sync`:");
    for (const file of changes) {
      console.error(`- ${file}`);
    }
    process.exitCode = 1;
  }
}
