#!/usr/bin/env node

/**
 * A small XML reader for published package metadata.
 *
 * The SBOM scripts run from a bare checkout in three workflows, including the
 * release-time one that takes the generator from the default branch and runs
 * it against a released commit, so they carry no dependencies. That ruled out
 * a parser package — but regexes cannot read XML, and the readers that used
 * them accepted a long tail of documents that hold the right tags in the wrong
 * structure: a closing tag inside a comment, an attribute value containing
 * text that looks like another attribute, a body truncated mid-element. Every
 * one of those read as "this package declares no dependencies".
 *
 * This tokenises properly instead. It is not a general XML implementation —
 * no namespaces resolution, no DTDs, no entity declarations — but it does
 * respect the grammar that matters here: comments, CDATA, quoted attribute
 * values, self-closing elements, and matched nesting.
 */

export class XmlParseError extends Error {}

const NAME_START = /[A-Za-z_:]/u;
const NAME_CHAR = /[-A-Za-z0-9_:.]/u;

const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

function decodeEntities(text, context) {
  // A bare `&` and an undeclared entity are both malformed. This reader
  // supports no DTD, so any name outside the predefined five is undeclared,
  // and passing the reference through unchanged would put markup-looking text
  // into a value the caller treats as data.
  if (/&(?!(?:#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);)/u.test(text)) {
    fail("Unescaped '&' in character data", context);
  }
  return text.replace(
    /&(#x?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/gu,
    (raw, body) => {
      if (body.startsWith("#x") || body.startsWith("#X")) {
        const code = Number.parseInt(body.slice(2), 16);
        if (Number.isNaN(code)) fail(`Malformed entity ${raw}`, context);
        return String.fromCodePoint(code);
      }
      if (body.startsWith("#")) {
        const code = Number.parseInt(body.slice(1), 10);
        if (Number.isNaN(code)) fail(`Malformed entity ${raw}`, context);
        return String.fromCodePoint(code);
      }
      const named = ENTITIES.get(body);
      if (named === undefined) fail(`Undeclared entity ${raw}`, context);
      return named;
    },
  );
}

/**
 * A parsed element.
 *
 * `attributes` maps attribute name to its decoded value. `children` holds the
 * child elements in document order. `text` is the concatenated character data
 * directly inside this element, with entities decoded.
 */
class XmlElement {
  constructor(name) {
    this.name = name;
    this.attributes = new Map();
    this.children = [];
    this.text = "";
  }

  /** Direct children with this tag name. */
  all(name) {
    return this.children.filter((child) => child.name === name);
  }

  /** The first direct child with this tag name, or undefined. */
  first(name) {
    return this.children.find((child) => child.name === name);
  }

  /** The trimmed text of the first direct child with this name, or undefined. */
  value(name) {
    const child = this.first(name);
    return child === undefined ? undefined : child.text.trim();
  }

  attribute(name) {
    return this.attributes.get(name);
  }
}

function fail(message, context) {
  throw new XmlParseError(
    context?.url ? `${message}: ${context.url}` : message,
  );
}

function readName(source, start) {
  if (start >= source.length || !NAME_START.test(source[start])) return null;
  let end = start + 1;
  while (end < source.length && NAME_CHAR.test(source[end])) end += 1;
  return { name: source.slice(start, end), end };
}

/**
 * Parse an XML document and return its root element.
 *
 * Throws XmlParseError on anything that is not a well-formed document: an
 * unterminated comment or CDATA section, an unquoted or unterminated attribute
 * value, a mismatched or unclosed element, or trailing content after the root.
 */
export function parseXml(source, context) {
  if (typeof source !== "string" || source.trim() === "") {
    fail("Empty XML document", context);
  }

  const stack = [];
  let root = null;
  let index = 0;

  const skipUntil = (marker, what) => {
    const at = source.indexOf(marker, index);
    if (at < 0) fail(`Unterminated ${what}`, context);
    index = at + marker.length;
  };

  while (index < source.length) {
    const next = source.indexOf("<", index);
    if (next < 0) {
      // Trailing character data. Only whitespace may follow the root element.
      if (source.slice(index).trim() !== "" && stack.length === 0) {
        fail("Character data outside the root element", context);
      }
      break;
    }

    if (next > index) {
      const text = source.slice(index, next);
      // XML forbids the literal `]]>` in character data; `-->` is legal there.
      if (text.includes("]]>")) {
        fail("Character data contains ]]>", context);
      }
      if (stack.length > 0) {
        stack[stack.length - 1].text += decodeEntities(text, context);
      } else if (text.trim() !== "") {
        fail("Character data outside the root element", context);
      }
    }
    index = next;

    if (source.startsWith("<!--", index)) {
      const close = source.indexOf("-->", index + 4);
      if (close < 0) fail("Unterminated comment", context);
      // XML forbids `--` inside a comment body, so a document containing one
      // is malformed however plausible it looks.
      if (source.slice(index + 4, close).includes("--")) {
        fail("Comment contains --", context);
      }
      index = close + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", index)) {
      const close = source.indexOf("]]>", index + 9);
      if (close < 0) fail("Unterminated CDATA section", context);
      // Character data is only legal inside an element. Ignoring a section
      // outside the root would let an error page prefixed to a document pass
      // as valid metadata.
      if (stack.length === 0) {
        fail("CDATA outside the root element", context);
      }
      stack[stack.length - 1].text += source.slice(index + 9, close);
      index = close + 3;
      continue;
    }
    if (source.startsWith("<?", index)) {
      index += 2;
      skipUntil("?>", "processing instruction");
      continue;
    }
    if (source.startsWith("<!", index)) {
      // A declaration such as <!DOCTYPE …>. `<!` is only legal before `--`,
      // `[CDATA[` — both handled above — or a name, so anything else is
      // malformed. Accepting it would let `<!-` open a pseudo-comment that
      // swallows a real declaration, which is how the regex reader was fooled.
      if (!readName(source, index + 2)) fail("Malformed declaration", context);
      index += 2;
      skipUntil(">", "declaration");
      continue;
    }

    if (source.startsWith("</", index)) {
      const named = readName(source, index + 2);
      if (!named) fail("Malformed closing tag", context);
      let cursor = named.end;
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
      if (source[cursor] !== ">") fail("Malformed closing tag", context);
      const open = stack.pop();
      if (!open) fail(`Unexpected closing tag </${named.name}>`, context);
      if (open.name !== named.name) {
        fail(
          `Closing tag </${named.name}> does not match <${open.name}>`,
          context,
        );
      }
      index = cursor + 1;
      continue;
    }

    const named = readName(source, index + 1);
    if (!named) fail("Malformed opening tag", context);
    const element = new XmlElement(named.name);
    let cursor = named.end;

    for (;;) {
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
      if (cursor >= source.length) fail("Unterminated opening tag", context);
      if (source[cursor] === ">" || source.startsWith("/>", cursor)) break;

      const attribute = readName(source, cursor);
      if (!attribute) fail(`Malformed attribute in <${named.name}>`, context);
      cursor = attribute.end;
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
      if (source[cursor] !== "=") {
        fail(`Attribute ${attribute.name} has no value`, context);
      }
      cursor += 1;
      while (cursor < source.length && /\s/u.test(source[cursor])) cursor += 1;
      const quote = source[cursor];
      if (quote !== '"' && quote !== "'") {
        fail(`Attribute ${attribute.name} has an unquoted value`, context);
      }
      const close = source.indexOf(quote, cursor + 1);
      if (close < 0) {
        fail(`Attribute ${attribute.name} has an unterminated value`, context);
      }
      const raw = source.slice(cursor + 1, close);
      // `<` is never legal in an attribute value, and a repeated attribute is
      // malformed — silently overwriting it let `id="A" id="B"` read as B.
      if (raw.includes("<")) {
        fail(`Attribute ${attribute.name} contains a raw '<'`, context);
      }
      if (element.attributes.has(attribute.name)) {
        fail(`Duplicate attribute ${attribute.name}`, context);
      }
      // The value is opaque: whatever it contains is character data, never
      // markup. This is the property a regex reader cannot honour.
      element.attributes.set(attribute.name, decodeEntities(raw, context));
      cursor = close + 1;
    }

    const selfClosing = source.startsWith("/>", cursor);
    index = cursor + (selfClosing ? 2 : 1);

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(element);
    } else if (root) {
      fail("More than one root element", context);
    } else {
      root = element;
    }
    if (!selfClosing) stack.push(element);
  }

  if (stack.length > 0) {
    fail(`Unclosed element <${stack[stack.length - 1].name}>`, context);
  }
  if (!root) fail("XML document has no root element", context);
  return root;
}
