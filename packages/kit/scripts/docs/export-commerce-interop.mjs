import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { COMMERCE_IMPLEMENTATION_TOPICS } from "../../../docs/src/lib/commerceImplementations.ts";
import { assertSourceHashes } from "./commerce-source-snapshot.mjs";

const kit = resolve(import.meta.dir, "../..");
const [run, exampleArg] = process.argv.slice(2);
assert(
  run && exampleArg,
  "Usage: bun export-commerce-interop.mjs <run-directory> <example-checkout>",
);
const example = resolve(exampleArg),
  docs = resolve(kit, "../docs/public");
const report = JSON.parse(readFileSync(join(run, "report.json"), "utf8"));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
assert.equal(report.checkCount, report.checks.length);
assert.deepEqual(report.changedConsumerFiles, []);
for (const [project, root] of [
  ["openiap", kit],
  ["example", example],
  ["workspace", resolve(kit, "../..")],
])
  assertSourceHashes(root, report.sources[project]?.hashes);
assertSourceHashes(import.meta.dir, report.harnessHashes);
const sources = {};
for (const [project, root] of [
  ["example", example],
  ["kit", kit],
]) {
  const files = new Set(
    Object.values(COMMERCE_IMPLEMENTATION_TOPICS).flatMap((topic) => [
      topic[project].file,
      topic[project].checkFile,
    ]),
  );
  if (project === "example")
    for (const file of Object.keys(report.consumerHashes)) files.add(file);
  else
    for (const file of Object.keys(report.harnessHashes))
      files.add(`scripts/docs/${file}`);
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const expected =
      project === "kit" && file.startsWith("scripts/docs/")
        ? report.harnessHashes[file.slice("scripts/docs/".length)]
        : report.sources[project === "kit" ? "openiap" : "example"].hashes[
            file
          ];
    assert(expected, `${project}/${file}: source was not pinned for this run`);
    assert.equal(
      hash(source),
      expected,
      `${project}/${file}: changed after the recorded run`,
    );
    sources[`${project}/${file}`] = source;
    const target = join(docs, "commerce-source", project, file + ".html");
    mkdirSync(dirname(target), { recursive: true });
    const title = `${project === "kit" ? "IAPKit" : "Commerce Protocol Example"} · ${file}`;
    writeFileSync(
      target,
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title><style>body{margin:0;font:15px/1.6 system-ui;color:#232323;background:#fff}header{padding:20px 28px;border-bottom:1px solid #ddd}h1{font-size:20px;overflow-wrap:anywhere}p{margin:5px 0;color:#606060}a{color:#946856}pre{padding:20px 0;margin:0;overflow:auto;line-height:1.7;font-size:13px}code{display:block;min-width:max-content}code:target{background:#fff0cc}code a{display:inline-block;text-align:right;width:4em;padding-right:2em;text-decoration:none;color:#777}small{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#171717;color:#eee}p{color:#bbb}header{border-color:#444}code:target{background:#473618}}</style><header><a href="/commerce-protocol/ecosystem#composition-proof">← Provider replacement walkthrough</a><h1>${escape(title)}</h1><p>Source snapshot · ${escape(report.recordedAt.slice(0, 10))}</p><small>SHA-256 ${hash(source)}</small></header><pre>${source
        .split("\n")
        .map(
          (line, index) =>
            `<code id="L${index + 1}"><a href="#L${index + 1}">${index + 1}</a>${escape(line) || " "}</code>`,
        )
        .join("")}</pre></html>`,
    );
  }
}
const assets = join(docs, "commerce-composition");
mkdirSync(assets, { recursive: true });
cpSync(join(run, "report.json"), join(assets, "iapkit-run.json"));
writeFileSync(
  join(assets, "iapkit-source.json"),
  JSON.stringify(sources, null, 2) + "\n",
);
writeFileSync(
  join(assets, "iapkit-source-manifest.json"),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(sources).map(([file, source]) => [file, hash(source)]),
    ),
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${report.checkCount} checks and ${Object.keys(sources).length} readable source snapshots.`,
);
