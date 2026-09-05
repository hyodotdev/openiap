import assert from "node:assert/strict";
import test from "node:test";

import { parseXml, XmlParseError } from "./xml-document.mjs";

test("the XML reader refuses documents that only look well-formed", () => {
  // Found by a second reviewer reading the parse loop. None is a realistic POM
  // or nuspec, but each is a document that is not well-formed being read as one.
  for (const [why, source] of [
    ["an unquoted declaration version", `<?xml version=1.0?><root/>`],
    ["no space between attributes", `<root a="1"b="2"/>`],
    ["a comment ending in -", `<root><!-- x ---></root>`],
    ["a repeated DOCTYPE", `<!DOCTYPE a><!DOCTYPE b><root/>`],
    // XML spells DOCTYPE in upper case.
    ["a lower-case doctype", `<!doctype a><root/>`],
    ["an unterminated quoted identifier", `<!DOCTYPE a SYSTEM "oops<root/>`],
  ]) {
    assert.throws(() => parseXml(source), XmlParseError, why);
  }

  // The valid spellings of each still parse.
  for (const source of [
    `<?xml version="1.0"?><root/>`,
    `<root a="1" b="2"/>`,
    `<root><!-- x --></root>`,
    `<!DOCTYPE a><root/>`,
    // A system identifier is quoted and may hold a `>`.
    `<!DOCTYPE a SYSTEM "http://x/a>b.dtd"><root/>`,
  ]) {
    assert.ok(parseXml(source));
  }
});
