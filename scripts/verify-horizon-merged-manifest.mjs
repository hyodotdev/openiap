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

import { parseXml, XmlParseError } from "./xml-document.mjs";

export const HORIZON_APP_ID_META_DATA_NAME =
  "com.meta.horizon.platform.HORIZON_APP_ID";

const APP_ID = /^\d{10,}$/;

// Every meta-data element in the subtree, at any depth.
const allMetaData = (element, found = []) => {
  if (element.name === "meta-data") found.push(element);
  for (const child of element.children) allMetaData(child, found);
  return found;
};

const isHorizon = (element) =>
  element.attribute("android:name") === HORIZON_APP_ID_META_DATA_NAME;

export function inspectMergedManifest(contents) {
  // Parsed, not pattern-matched: android:name must be an attribute, not text
  // that appears inside some other attribute's value, and a self-closing
  // sibling must not swallow the elements after it.
  let root;
  try {
    root = parseXml(contents, {});
  } catch (error) {
    if (error instanceof XmlParseError) {
      return `the merged manifest is not well-formed XML: ${error.message}`;
    }
    throw error;
  }

  // Horizon reads the id from <application>. The same declaration nested in an
  // activity or service merges somewhere the platform never looks, so scanning
  // the document globally would accept a manifest that fails at runtime.
  const application = root.first("application");
  if (!application) {
    return "the merged manifest has no <application> element";
  }
  const elements = application.all("meta-data").filter(isHorizon);

  if (elements.length === 0) {
    return allMetaData(root).some(isHorizon)
      ? `the merged manifest declares ${HORIZON_APP_ID_META_DATA_NAME} outside <application>`
      : `the merged manifest declares no ${HORIZON_APP_ID_META_DATA_NAME}`;
  }
  for (const element of elements) {
    const value = element.attribute("android:value");
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
