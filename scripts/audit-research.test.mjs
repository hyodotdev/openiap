import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appliedReferences,
  behaviorIdReferences,
  bibliographyKeys,
  bibliographyLinks,
  citeKeyReferences,
  docsSlugReferences,
  extractHrefs,
  hostOf,
  bareResearchFileReferences,
  repoPathReferences,
  suiteVersionLiterals,
} from "./audit-research.mjs";

const BIB_FIXTURE = `# Bibliography

### mulliner2014virtualswindle

Text. <https://example.org/a.pdf>

- Applied: docs \`features/validation\` callout;
  \`packages/conformance/src/spec/behaviors.mjs\` (backlog R2).

### li2023gosemver

- OpenIAP relevance: mentions \`src/spec/behaviors.mjs\` relative path.
- Applied: \`scripts/mine-iap-issues.mjs\` and glob \`specs/client/src/*.graphql\`.
`;

test("extracts cite keys from headings", () => {
  assert.deepEqual(bibliographyKeys(BIB_FIXTURE), [
    "mulliner2014virtualswindle",
    "li2023gosemver",
  ]);
});

test("extracts autolinked source urls", () => {
  assert.deepEqual(
    [...bibliographyLinks(BIB_FIXTURE)],
    ["https://example.org/a.pdf"],
  );
});

test("applied references come only from Applied bullets", () => {
  const refs = appliedReferences(BIB_FIXTURE);
  assert.ok(refs.includes("packages/conformance/src/spec/behaviors.mjs"));
  assert.ok(refs.includes("features/validation"));
  assert.ok(
    !refs.includes("src/spec/behaviors.mjs"),
    "relevance-line paths must not be collected",
  );
});

test("repo path filter keeps whitelisted real paths and drops globs", () => {
  const paths = repoPathReferences([
    "packages/conformance/src/spec/behaviors.mjs",
    "specs/client/src/*.graphql",
    "src/spec/behaviors.mjs",
    "bun run audit:schema-semver",
    ".github/workflows/ci.yml",
  ]);
  assert.deepEqual(paths, [
    "packages/conformance/src/spec/behaviors.mjs",
    ".github/workflows/ci.yml",
  ]);
});

test("docs slugs match section/page shape only", () => {
  assert.deepEqual(
    docsSlugReferences(["features/validation", "not a slug", "a/b/c"]),
    ["features/validation"],
  );
});

test("cite key detector matches the key shape and nothing else", () => {
  const source =
    "see mulliner2014virtualswindle and li2023gosemver, but not " +
    "ndss2017_05A-2_Yang_paper.pdf nor asiaccs2014_x nor plain 2014.";
  assert.deepEqual(citeKeyReferences(source), [
    "mulliner2014virtualswindle",
    "li2023gosemver",
  ]);
});

test("behavior id detector requires hyphenated ids", () => {
  const categories = ["products", "verification"];
  const source =
    "products.find((p) => p.id) is code; " +
    "verification.forged-token-is-invalid is a behavior id.";
  assert.deepEqual(behaviorIdReferences(source, categories), [
    "verification.forged-token-is-invalid",
  ]);
});

test("href extraction covers TSX-data and JSX-attribute forms", () => {
  const source =
    "href: 'https://example.org/a.pdf',\n" +
    '<a href="https://example.org/b" target="_blank">x</a>';
  assert.deepEqual(extractHrefs(source), [
    "https://example.org/a.pdf",
    "https://example.org/b",
  ]);
});

test("hostname extraction backs the scholarly-host scoping", () => {
  assert.equal(hostOf("https://dl.acm.org/doi/10.1145/3143561"), "dl.acm.org");
});

test("bare research-file references resolve inside knowledge/research", () => {
  assert.deepEqual(
    bareResearchFileReferences([
      "misuse-catalog.md",
      "packages/x/y.md",
      "notmd",
    ]),
    ["misuse-catalog.md"],
  );
});

test("suite-version literals are collected for the constant check", () => {
  assert.deepEqual(
    suiteVersionLiterals("Ships with suite 3.0.0. Later suite 4.1.2 too."),
    ["3.0.0", "4.1.2"],
  );
});
