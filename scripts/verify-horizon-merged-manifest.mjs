#!/usr/bin/env node
// Assert that a merged Android manifest resolves a usable Horizon app id.
//
// A build file's text cannot prove this. The value reaching the manifest
// depends on which properties are set, which flavor is building, and how the
// expression short-circuits, so a static read of the Gradle source can only
// approximate it. The manifest merger has already made that decision, so this
// reads its output instead.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const HORIZON_APP_ID_META_DATA_NAME =
  "com.meta.horizon.platform.HORIZON_APP_ID";

const META_DATA_ELEMENT = /<meta-data\b[\s\S]*?(?:\/>|<\/meta-data\s*>)/g;
const NAME_ATTRIBUTE = /android:name\s*=\s*"([^"]*)"/;
const VALUE_ATTRIBUTE = /android:value\s*=\s*"([^"]*)"/;
const APP_ID = /^\d{10,}$/;

// Replace to a fixpoint: removing an inner `<!-- -->` can splice `<!-` and `-`
// into a new opener the pass never saw, so one substitution is not a strip.
const stripXmlComments = (source) => {
  let previous;
  let current = source;
  do {
    previous = current;
    current = previous.replace(/<!--[\s\S]*?-->/g, "");
  } while (current !== previous);
  return current;
};

export function inspectMergedManifest(contents) {
  // Comments are not declarations, and android:name must match exactly — a
  // substring test would accept com.example.<the Horizon name>.
  const elements = [...stripXmlComments(contents).matchAll(META_DATA_ELEMENT)]
    .map(([element]) => element)
    .filter(
      (element) =>
        element.match(NAME_ATTRIBUTE)?.[1] === HORIZON_APP_ID_META_DATA_NAME,
    );

  if (elements.length === 0) {
    return `the merged manifest declares no ${HORIZON_APP_ID_META_DATA_NAME}`;
  }
  for (const element of elements) {
    const value = element.match(VALUE_ATTRIBUTE)?.[1];
    if (value === undefined)
      return "the Horizon meta-data has no android:value";
    if (value === "") {
      return "the Horizon app id merged as empty, so startConnection will throw";
    }
    // An unresolved placeholder means the build never supplied the property.
    if (value.startsWith("${")) {
      return `the Horizon app id merged unresolved as ${value}`;
    }
    if (!APP_ID.test(value)) {
      return `the Horizon app id merged as ${JSON.stringify(value)}, which is not an app id`;
    }
  }
  return null;
}

export function verifyMergedManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return `${manifestPath} does not exist; build the Horizon variant first`;
  }
  return inspectMergedManifest(fs.readFileSync(manifestPath, "utf8"));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [manifestPath] = process.argv.slice(2);
  if (!manifestPath) {
    console.error(
      "usage: verify-horizon-merged-manifest.mjs <AndroidManifest.xml>",
    );
    process.exit(2);
  }
  const resolved = path.resolve(manifestPath);
  const issue = verifyMergedManifest(resolved);
  if (issue) {
    console.error(`FAIL ${issue}`);
    process.exit(1);
  }
  console.log(
    `Horizon app id resolves in ${path.relative(process.cwd(), resolved)}`,
  );
}
