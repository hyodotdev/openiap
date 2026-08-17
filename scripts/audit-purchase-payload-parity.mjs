import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Purchase payload fields are discovered from generated native/GQL models.
// This audit intentionally keeps only transport-only fields and documented
// store defaults as local exceptions, so schema growth cannot be hidden by a
// duplicated hand-written field inventory.
let root = "";
let failures = [];

function abs(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(abs(relativePath));
}

function fail(message) {
  failures.push(message);
}

function expectFile(relativePath) {
  if (!exists(relativePath)) fail(`missing file: ${relativePath}`);
}

function expectIncludes(relativePath, needles, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function expectNotIncludes(relativePath, needles, label = relativePath) {
  expectFile(relativePath);
  if (!exists(relativePath)) return;
  const text = read(relativePath);
  for (const needle of needles) {
    if (text.includes(needle)) {
      fail(`${label} must not include ${JSON.stringify(needle)}`);
    }
  }
}

function expectSameSet(label, expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = [...expectedSet].filter((entry) => !actualSet.has(entry));
  const extra = [...actualSet].filter((entry) => !expectedSet.has(entry));
  if (missing.length > 0 || extra.length > 0) {
    fail(
      `${label} mismatch (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
}

function uniqueMatches(text, regex, group = 1) {
  regex.lastIndex = 0;
  return [...new Set([...text.matchAll(regex)].map((match) => match[group]))]
    .filter(Boolean)
    .sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLineTerminator(char) {
  return (
    char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029"
  );
}

function skipNestedBlockComment(text, start) {
  let depth = 1;
  let index = start + 2;
  while (index < text.length && depth > 0) {
    if (text.startsWith("/*", index)) {
      depth += 1;
      index += 2;
      continue;
    }
    if (text.startsWith("*/", index)) {
      depth -= 1;
      index += 2;
      continue;
    }
    index += 1;
  }
  return index;
}

function skipLineComment(text, start) {
  let index = start + 2;
  while (index < text.length && !isLineTerminator(text[index])) {
    index += 1;
  }
  return index;
}

function maskDelimitedLiteral(text, start, end, delimiter) {
  const literal = text.slice(start, end);
  const closed = literal.endsWith(delimiter);
  const closingStart = closed ? literal.length - delimiter.length : Infinity;
  let masked = "";
  for (let index = 0; index < literal.length; index += 1) {
    const char = literal[index];
    masked +=
      isLineTerminator(char) ||
      index < delimiter.length ||
      index >= closingStart
        ? char
        : " ";
  }
  return masked;
}

function kotlinStringDescriptorAt(text, index) {
  if (text.startsWith('"""', index)) {
    return { delimiter: '"""', interpolates: true, raw: true };
  }
  if (text[index] === '"' || text[index] === "'") {
    return { delimiter: text[index], interpolates: true, raw: false };
  }
  if (text[index] === "`") {
    return { delimiter: "`", interpolates: false, raw: true };
  }
  return null;
}

function findKotlinInterpolationEnd(text, start) {
  let depth = 1;
  let index = start;
  while (index < text.length && depth > 0) {
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index);
      continue;
    }
    if (text.startsWith("/*", index)) {
      index = skipNestedBlockComment(text, index);
      continue;
    }
    const descriptor = kotlinStringDescriptorAt(text, index);
    if (descriptor) {
      index = findKotlinStringEnd(text, index, descriptor);
      continue;
    }
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") depth -= 1;
    index += 1;
  }
  return index;
}

function findKotlinStringEnd(text, start, descriptor) {
  const { delimiter, interpolates, raw } = descriptor;
  let index = start + delimiter.length;
  while (index < text.length) {
    if (text.startsWith(delimiter, index)) {
      return index + delimiter.length;
    }
    if (!raw && text[index] === "\\") {
      index += 2;
      continue;
    }
    if (interpolates && text[index] === "$" && text[index + 1] === "{") {
      index = findKotlinInterpolationEnd(text, index + 2);
      continue;
    }
    index += 1;
  }
  return text.length;
}

function maskKotlinCommentsAndStrings(text) {
  let masked = "";
  let state = "code";
  let blockDepth = 0;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        masked += "  ";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        blockDepth = 1;
        masked += "  ";
        index += 2;
        continue;
      }
      const descriptor = kotlinStringDescriptorAt(text, index);
      if (descriptor) {
        const end = findKotlinStringEnd(text, index, descriptor);
        masked += maskDelimitedLiteral(text, index, end, descriptor.delimiter);
        index = end;
        continue;
      }
      masked += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (isLineTerminator(char)) state = "code";
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (char === "/" && next === "*") {
        blockDepth += 1;
        masked += "  ";
        index += 2;
        continue;
      }
      if (char === "*" && next === "/") {
        blockDepth -= 1;
        if (blockDepth === 0) state = "code";
        masked += "  ";
        index += 2;
        continue;
      }
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
  }
  return masked;
}

function hasDartRawStringPrefix(text, quoteIndex) {
  const prefix = text[quoteIndex - 1];
  const beforePrefix = text[quoteIndex - 2];
  return (
    (prefix === "r" || prefix === "R") &&
    (beforePrefix === undefined || !/[A-Za-z0-9_$]/.test(beforePrefix))
  );
}

function dartStringDescriptorAt(text, index) {
  const char = text[index];
  if (char !== "'" && char !== '"') return null;
  return {
    delimiter: text.startsWith(char.repeat(3), index) ? char.repeat(3) : char,
    raw: hasDartRawStringPrefix(text, index),
  };
}

function findDartInterpolationEnd(text, start) {
  let depth = 1;
  let index = start;
  while (index < text.length && depth > 0) {
    if (text.startsWith("//", index)) {
      index = skipLineComment(text, index);
      continue;
    }
    if (text.startsWith("/*", index)) {
      index = skipNestedBlockComment(text, index);
      continue;
    }
    const descriptor = dartStringDescriptorAt(text, index);
    if (descriptor) {
      index = findDartStringEnd(text, index, descriptor);
      continue;
    }
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}") depth -= 1;
    index += 1;
  }
  return index;
}

function findDartStringEnd(text, start, descriptor) {
  const { delimiter, raw } = descriptor;
  let index = start + delimiter.length;
  while (index < text.length) {
    if (text.startsWith(delimiter, index)) {
      return index + delimiter.length;
    }
    if (!raw && text[index] === "\\") {
      index += 2;
      continue;
    }
    if (!raw && text[index] === "$" && text[index + 1] === "{") {
      index = findDartInterpolationEnd(text, index + 2);
      continue;
    }
    index += 1;
  }
  return text.length;
}

// Dart supports raw, multiline, and interpolated strings plus nested block
// comments. Mask them while preserving indices so delimiters inside literals
// and comments cannot confuse structural scans.
function maskDartCommentsAndStrings(text) {
  let masked = "";
  let state = "code";
  let blockDepth = 0;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        masked += "  ";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        blockDepth = 1;
        masked += "  ";
        index += 2;
        continue;
      }
      const descriptor = dartStringDescriptorAt(text, index);
      if (descriptor) {
        const end = findDartStringEnd(text, index, descriptor);
        masked += maskDelimitedLiteral(text, index, end, descriptor.delimiter);
        index = end;
        continue;
      }
      masked += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (isLineTerminator(char)) state = "code";
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (char === "/" && next === "*") {
        blockDepth += 1;
        masked += "  ";
        index += 2;
        continue;
      }
      if (char === "*" && next === "/") {
        blockDepth -= 1;
        if (blockDepth === 0) state = "code";
        masked += "  ";
        index += 2;
        continue;
      }
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
  }
  return masked;
}

function findTypeScriptLiteralRanges(text) {
  const sourceFile = ts.createSourceFile(
    "payload-audit.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const ranges = [];
  function visit(node) {
    if (
      node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
      node.kind === ts.SyntaxKind.StringLiteral ||
      node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
      node.kind === ts.SyntaxKind.TemplateExpression ||
      node.kind === ts.SyntaxKind.TemplateLiteralType
    ) {
      ranges.push([node.getStart(sourceFile), node.end]);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return ranges.sort(([left], [right]) => left - right);
}

function maskTypeScriptCommentsAndStrings(text) {
  const literalRanges = findTypeScriptLiteralRanges(text);
  let literalRangeIndex = 0;
  let masked = "";
  let state = "code";
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (state === "code") {
      while (
        literalRanges[literalRangeIndex] &&
        literalRanges[literalRangeIndex][0] < index
      ) {
        literalRangeIndex += 1;
      }
      const literalRange = literalRanges[literalRangeIndex];
      if (literalRange?.[0] === index) {
        const [start, end] = literalRange;
        masked += text.slice(start, end).replace(/[^\r\n\u2028\u2029]/g, " ");
        index = end;
        literalRangeIndex += 1;
        continue;
      }
      if (char === "/" && next === "/") {
        state = "line";
        masked += "  ";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        masked += "  ";
        index += 2;
        continue;
      }
      masked += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (isLineTerminator(char)) state = "code";
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        masked += "  ";
        index += 2;
        continue;
      }
      masked += isLineTerminator(char) ? char : " ";
      index += 1;
      continue;
    }
  }
  return masked;
}

function extractBalancedAfterMarker(
  text,
  marker,
  open,
  close,
  label,
  mask = maskKotlinCommentsAndStrings,
) {
  const masked = mask(text);
  const markerIndex = masked.indexOf(marker);
  if (markerIndex < 0) {
    fail(`${label} is missing ${JSON.stringify(marker)}`);
    return null;
  }

  const openIndex = masked.indexOf(open, markerIndex + marker.length);
  if (openIndex < 0) {
    fail(`${label} is missing ${open} after ${JSON.stringify(marker)}`);
    return null;
  }

  let depth = 1;
  let index = openIndex + 1;
  while (index < masked.length && depth > 0) {
    if (masked[index] === open) depth += 1;
    else if (masked[index] === close) depth -= 1;
    index += 1;
  }
  if (depth !== 0) {
    fail(`${label} has an unbalanced ${open}${close} block`);
    return null;
  }

  return {
    body: text.slice(openIndex + 1, index - 1),
    end: index,
    start: openIndex,
  };
}

function extractDartFunctionBody(text, marker, label) {
  return extractFunctionBody(text, marker, label, maskDartCommentsAndStrings);
}

function extractTypeScriptFunctionBody(text, marker, label) {
  return extractFunctionBody(
    text,
    marker,
    label,
    maskTypeScriptCommentsAndStrings,
  );
}

function extractFunctionBody(
  text,
  marker,
  label,
  mask = maskKotlinCommentsAndStrings,
) {
  const parameters = extractBalancedAfterMarker(
    text,
    marker,
    "(",
    ")",
    label,
    mask,
  );
  if (!parameters) return null;

  const suffix = text.slice(parameters.end);
  return extractBalancedAfterMarker(suffix, "", "{", "}", label, mask);
}

function splitTopLevelSegments(text, mask = maskDartCommentsAndStrings) {
  const masked = mask(text);
  const segments = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index];
    if (char === "(" || char === "{" || char === "[") depth += 1;
    else if (char === ")" || char === "}" || char === "]") depth -= 1;
    else if (char === "," && depth === 0) {
      segments.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail.length > 0) segments.push(tail);
  return segments.filter(Boolean);
}

function parseKotlinToJsonKeys(text, type, relativePath) {
  const classBlock = extractBalancedAfterMarker(
    text,
    `public data class ${type}(`,
    "{",
    "}",
    `${relativePath} ${type}`,
  );
  if (!classBlock) return [];

  const mapBlock = extractBalancedAfterMarker(
    classBlock.body,
    "override fun toJson(): Map<String, Any?> = mapOf",
    "(",
    ")",
    `${relativePath} ${type}.toJson`,
  );
  if (!mapBlock) return [];

  return [
    ...new Set(
      splitTopLevelSegments(mapBlock.body, maskKotlinCommentsAndStrings)
        .map((segment) => segment.match(/^\s*"([^"]+)"\s+to\b/)?.[1])
        .filter((key) => key && key !== "__typename"),
    ),
  ].sort();
}

function parseSwiftStoredPropertyNames(text, type, relativePath) {
  const classBlock = extractBalancedAfterMarker(
    text,
    `public struct ${type}:`,
    "{",
    "}",
    `${relativePath} ${type}`,
  );
  if (!classBlock) return [];

  return uniqueMatches(
    classBlock.body,
    /^\s*public var ([A-Za-z][A-Za-z0-9_]*)\s*:/gm,
  );
}

function parseDartFromJsonKeys(text, type, relativePath) {
  const classBlock = extractBalancedAfterMarker(
    text,
    `class ${type} `,
    "{",
    "}",
    `${relativePath} ${type}`,
    maskDartCommentsAndStrings,
  );
  if (!classBlock) return [];

  const factoryBlock = extractBalancedAfterMarker(
    classBlock.body,
    `factory ${type}.fromJson`,
    "{",
    "}",
    `${relativePath} ${type}.fromJson`,
    maskDartCommentsAndStrings,
  );
  if (!factoryBlock) return [];

  return uniqueMatches(factoryBlock.body, /json\['([^']+)'\]/g);
}

function parseDartConstructorArgumentNames(
  text,
  type,
  relativePath,
  functionName,
) {
  const constructor = extractBalancedAfterMarker(
    text,
    `return gentype.${type}`,
    "(",
    ")",
    `${relativePath} ${functionName} ${type}`,
    maskDartCommentsAndStrings,
  );
  if (!constructor) return [];

  return splitTopLevelSegments(constructor.body, maskDartCommentsAndStrings)
    .map((segment) => segment.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:/)?.[1])
    .filter(Boolean)
    .sort();
}

function parseTypeScriptInterfaceFieldNames(text, type, relativePath) {
  const interfaceBlock = extractBalancedAfterMarker(
    text,
    `export interface ${type} `,
    "{",
    "}",
    `${relativePath} ${type}`,
    maskTypeScriptCommentsAndStrings,
  );
  if (!interfaceBlock) return [];

  return uniqueMatches(
    interfaceBlock.body,
    /^\s*(?:readonly\s+)?([A-Za-z][A-Za-z0-9_]*)\??\s*:/gm,
  );
}

function parseNamedCallArguments(
  text,
  marker,
  separator,
  label,
  mask = maskKotlinCommentsAndStrings,
) {
  const constructor = extractBalancedAfterMarker(
    text,
    marker,
    "(",
    ")",
    label,
    mask,
  );
  if (!constructor) return new Map();

  const entries = new Map();
  for (const segment of splitTopLevelSegments(constructor.body, mask)) {
    const masked = mask(segment);
    const codeStart = masked.search(/\S/);
    const code = codeStart < 0 ? "" : segment.slice(codeStart);
    const match = code.match(
      new RegExp(
        `^([A-Za-z][A-Za-z0-9_]*)\\s*${escapeRegExp(separator)}\\s*([\\s\\S]+)$`,
      ),
    );
    if (!match) {
      fail(`${label} has an unrecognized named argument: ${code}`);
      continue;
    }
    if (entries.has(match[1])) {
      fail(`${label} passes ${match[1]} more than once`);
      continue;
    }
    entries.set(match[1], match[2]);
  }
  return entries;
}

function normalizeExpression(expression) {
  return expression.replace(/\s+/g, " ").trim();
}

function expectNamedExpression(entries, field, pattern, label) {
  const expression = normalizeExpression(entries.get(field) ?? "");
  if (!pattern.test(expression)) {
    fail(
      `${label}.${field} has unexpected source expression ${JSON.stringify(expression)}`,
    );
  }
}

function expectMappedGeneratedFields(
  label,
  generatedFields,
  entries,
  intentionallyDefaultedFields = [],
) {
  const generated = new Set(generatedFields);
  const unknownDefaults = intentionallyDefaultedFields
    .filter((field) => !generated.has(field))
    .sort();
  if (unknownDefaults.length > 0) {
    fail(
      `${label} declares unknown defaulted fields: ${unknownDefaults.join(", ")}`,
    );
  }

  const defaulted = new Set(intentionallyDefaultedFields);
  expectSameSet(
    label,
    generatedFields.filter((field) => !defaulted.has(field)),
    [...entries.keys()],
  );
}

function parseTypeScriptObjectEntries(text, marker, label) {
  const object = extractBalancedAfterMarker(
    text,
    marker,
    "{",
    "}",
    label,
    maskTypeScriptCommentsAndStrings,
  );
  if (!object) return new Map();

  const entries = new Map();
  for (const segment of splitTopLevelSegments(
    object.body,
    maskTypeScriptCommentsAndStrings,
  )) {
    const masked = maskTypeScriptCommentsAndStrings(segment);
    const codeStart = masked.search(/\S/);
    const code = codeStart < 0 ? "" : segment.slice(codeStart);
    const explicit = code.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*([\s\S]+)$/);
    const shorthand = code.match(/^([A-Za-z][A-Za-z0-9_]*)$/);
    const name = explicit?.[1] ?? shorthand?.[1];
    if (!name) {
      fail(`${label} has an unrecognized object field: ${code}`);
      continue;
    }
    if (entries.has(name)) {
      fail(`${label} sets ${name} more than once`);
      continue;
    }
    entries.set(name, explicit?.[2] ?? name);
  }
  return entries;
}

function parseDartMapEntries(mapBody, label) {
  const entries = new Map();
  for (const segment of splitTopLevelSegments(
    mapBody,
    maskDartCommentsAndStrings,
  )) {
    const masked = maskDartCommentsAndStrings(segment);
    const codeStart = masked.search(/\S/);
    const code = codeStart < 0 ? "" : segment.slice(codeStart);
    if (code.startsWith("...")) continue;
    const match = code.match(/^'([^']+)'\s*:\s*([\s\S]+)$/);
    if (!match) {
      fail(`${label} has an unrecognized top-level entry: ${code}`);
      continue;
    }
    if (entries.has(match[1])) {
      fail(`${label} overrides ${match[1]} more than once`);
      continue;
    }
    entries.set(match[1], match[2]);
  }
  return entries;
}

function hasDominatingOperator(prefix) {
  return /\?\?|\?|&&|\|\|/.test(prefix);
}

function firstCanonicalSourceReference(
  expression,
  functionBody,
  seenIdentifiers = new Set(),
) {
  const sourceReferenceCount = [...expression.matchAll(/\bsourcePayload\b/g)]
    .length;
  if (sourceReferenceCount > 1 && hasDominatingOperator(expression)) {
    return null;
  }
  if (/_transactionIdFrom\s*\(\s*sourcePayload\s*\)/.test(expression)) {
    return "transactionId";
  }

  const seenInExpression = new Set();
  const references =
    /sourcePayload\s*(?:\[\s*['"]([^'"]+)['"]\s*\]|\.containsKey\s*\(\s*['"]([^'"]+)['"]\s*\))|\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  for (const reference of expression.matchAll(references)) {
    const sourceKey = reference[1] ?? reference[2];
    if (sourceKey) {
      return hasDominatingOperator(expression.slice(0, reference.index))
        ? null
        : sourceKey;
    }
    const identifier = reference[3];
    if (seenInExpression.has(identifier)) continue;
    seenInExpression.add(identifier);
    if (seenIdentifiers.has(identifier)) continue;
    const declaration = functionBody.match(
      new RegExp(
        `(?:final|var)\\s+(?:[A-Za-z][A-Za-z0-9_<>?, ]*\\s+)?${escapeRegExp(identifier)}\\s*=([\\s\\S]*?);`,
      ),
    );
    const nextSeen = new Set([...seenIdentifiers, identifier]);
    if (declaration) {
      const sourceKey = firstCanonicalSourceReference(
        declaration[1],
        functionBody,
        nextSeen,
      );
      if (sourceKey) {
        return hasDominatingOperator(expression.slice(0, reference.index))
          ? null
          : sourceKey;
      }
    }

    const assignments = new RegExp(
      `\\b${escapeRegExp(identifier)}\\s*=(?!=)([\\s\\S]*?);`,
      "g",
    );
    for (const assignment of functionBody.matchAll(assignments)) {
      const sourceKey = firstCanonicalSourceReference(
        assignment[1],
        functionBody,
        nextSeen,
      );
      if (sourceKey) {
        return hasDominatingOperator(expression.slice(0, reference.index))
          ? null
          : sourceKey;
      }
    }
  }
  return null;
}

function firstNitroPurchaseSourceReference(
  expression,
  functionBody,
  seenIdentifiers = new Set(),
) {
  const seenInExpression = new Set();
  const references =
    /nitroPurchase\.([A-Za-z][A-Za-z0-9_]*)|\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  for (const reference of expression.matchAll(references)) {
    if (reference[1]) {
      return hasDominatingOperator(expression.slice(0, reference.index))
        ? null
        : reference[1];
    }
    const identifier = reference[2];
    if (seenInExpression.has(identifier)) continue;
    seenInExpression.add(identifier);
    if (seenIdentifiers.has(identifier)) continue;
    const declaration = functionBody.match(
      new RegExp(
        `(?:const|let|var)\\s+(?:[A-Za-z][A-Za-z0-9_<>?, |\\[\\]]*\\s+)?${escapeRegExp(identifier)}\\s*=([\\s\\S]*?);`,
      ),
    );
    if (!declaration) continue;
    const sourceKey = firstNitroPurchaseSourceReference(
      declaration[1],
      functionBody,
      new Set([...seenIdentifiers, identifier]),
    );
    if (sourceKey) {
      return hasDominatingOperator(expression.slice(0, reference.index))
        ? null
        : sourceKey;
    }
  }
  return null;
}

function typeScriptMemberReferences(
  expression,
  rootIdentifier,
  functionBody,
  seenIdentifiers = new Set(),
) {
  const masked = maskTypeScriptCommentsAndStrings(expression);
  const references = new Set();
  const pattern = new RegExp(
    `\\b${escapeRegExp(rootIdentifier)}(?:\\.|\\?\\.)([A-Za-z][A-Za-z0-9_]*)`,
    "g",
  );
  for (const match of masked.matchAll(pattern)) {
    references.add(match[1]);
  }
  if (!functionBody) return references;

  for (const match of masked.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\b/g)) {
    const identifier = match[1];
    if (
      identifier === rootIdentifier ||
      seenIdentifiers.has(identifier) ||
      references.has(identifier)
    ) {
      continue;
    }
    const declaration = functionBody.match(
      new RegExp(
        `(?:const|let|var)\\s+${escapeRegExp(identifier)}(?:\\s*:[^=;]+)?\\s*=([\\s\\S]*?);`,
      ),
    );
    if (!declaration) continue;
    const nested = typeScriptMemberReferences(
      declaration[1],
      rootIdentifier,
      functionBody,
      new Set([...seenIdentifiers, identifier]),
    );
    for (const field of nested) references.add(field);
  }
  return references;
}

function nestedTypeScriptMemberReferences(
  expression,
  rootIdentifier,
  parentField,
) {
  const masked = maskTypeScriptCommentsAndStrings(expression);
  const references = new Set();
  const pattern = new RegExp(
    `\\b${escapeRegExp(rootIdentifier)}(?:\\.|\\?\\.)${escapeRegExp(parentField)}(?:\\.|\\?\\.)([A-Za-z][A-Za-z0-9_]*)`,
    "g",
  );
  for (const match of masked.matchAll(pattern)) {
    references.add(match[1]);
  }
  return references;
}

function expectOnlySourceReferences(actual, allowed, label) {
  const unexpected = [...actual].filter((field) => !allowed.has(field)).sort();
  if (unexpected.length > 0) {
    fail(`${label} reads unexpected source fields: ${unexpected.join(", ")}`);
  }
}

function firstKotlinPurchaseSourceReference(expression) {
  return expression.match(
    /\b(?:androidPurchase|purchase)(?:\?)?\.([A-Za-z][A-Za-z0-9_]*)/,
  )?.[1];
}

function swiftDictionarySourceReferences(expression) {
  const references = new Set();
  let index = 0;
  let state = "code";
  while (index < expression.length) {
    const char = expression[index];
    const next = expression[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block";
        index += 2;
        continue;
      }
      if (char === '"') {
        state = "string";
        index += 1;
        continue;
      }
      if (expression.startsWith("dictionary", index)) {
        const suffix = expression.slice(index);
        const match = suffix.match(
          /^dictionary\s*\[\s*"([A-Za-z][A-Za-z0-9_]*)"\s*\]/,
        );
        if (match) {
          references.add(match[1]);
          index += match[0].length;
          continue;
        }
      }
      index += 1;
      continue;
    }
    if (state === "line") {
      if (isLineTerminator(char)) state = "code";
      index += 1;
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "string") {
      if (char === "\\") {
        index += 2;
      } else if (char === '"') {
        state = "code";
        index += 1;
      } else {
        index += 1;
      }
    }
  }
  return references;
}

function firstSwiftDictionarySourceReference(expression, functionBody) {
  const direct = expression.match(
    /dictionary\s*\[\s*"([A-Za-z][A-Za-z0-9_]*)"\s*\]/,
  );
  if (direct) return direct[1];

  const identifier = expression.trim().match(/^([A-Za-z][A-Za-z0-9_]*)$/)?.[1];
  if (!identifier) return null;
  const declarationIndex = functionBody.search(
    new RegExp(`\\b(?:let|var)\\s+${escapeRegExp(identifier)}\\b`),
  );
  if (declarationIndex < 0) return null;
  return functionBody
    .slice(declarationIndex)
    .match(/dictionary\s*\[\s*"([A-Za-z][A-Za-z0-9_]*)"\s*\]/)?.[1];
}

function checkFlutterPayloadContracts() {
  const kotlinPath =
    "packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt";
  const swiftPath = "packages/apple/Sources/Models/Types.swift";
  const dartTypesPath = "packages/gql/src/generated/types.dart";
  const flutterHelpersPath =
    "libraries/flutter_inapp_purchase/lib/helpers.dart";
  for (const relativePath of [
    kotlinPath,
    swiftPath,
    dartTypesPath,
    flutterHelpersPath,
  ]) {
    expectFile(relativePath);
  }
  if (
    !exists(kotlinPath) ||
    !exists(swiftPath) ||
    !exists(dartTypesPath) ||
    !exists(flutterHelpersPath)
  ) {
    return;
  }

  const kotlin = read(kotlinPath);
  const swift = read(swiftPath);
  const dartTypes = read(dartTypesPath);
  const helpers = read(flutterHelpersPath);
  const purchaseFields = {
    PurchaseAndroid: parseKotlinToJsonKeys(
      kotlin,
      "PurchaseAndroid",
      kotlinPath,
    ),
    PurchaseIOS: parseSwiftStoredPropertyNames(swift, "PurchaseIOS", swiftPath),
  };

  // Flutter intentionally exposes this transport-only field in addition to the
  // generated native purchase payloads.
  const flutterOnlyPurchaseFields = ["isAlternativeBilling"];
  for (const [type, nativeFields] of Object.entries(purchaseFields)) {
    expectSameSet(
      `Flutter ${type} decoder fields`,
      [...nativeFields, ...flutterOnlyPurchaseFields],
      parseDartFromJsonKeys(dartTypes, type, dartTypesPath),
    );
  }

  const productFields = {
    ProductAndroid: parseKotlinToJsonKeys(kotlin, "ProductAndroid", kotlinPath),
    ProductSubscriptionAndroid: parseKotlinToJsonKeys(
      kotlin,
      "ProductSubscriptionAndroid",
      kotlinPath,
    ),
    ProductIOS: parseSwiftStoredPropertyNames(swift, "ProductIOS", swiftPath),
    ProductSubscriptionIOS: parseSwiftStoredPropertyNames(
      swift,
      "ProductSubscriptionIOS",
      swiftPath,
    ),
  };
  const productFunction = extractDartFunctionBody(
    helpers,
    "gentype.ProductCommon parseProductFromNative",
    `${flutterHelpersPath} parseProductFromNative`,
  );
  if (productFunction) {
    for (const [type, nativeFields] of Object.entries(productFields)) {
      expectSameSet(
        `Flutter parseProductFromNative ${type} fields`,
        nativeFields,
        parseDartConstructorArgumentNames(
          productFunction.body,
          type,
          flutterHelpersPath,
          "parseProductFromNative",
        ),
      );
    }
  }

  const convertFunction = extractDartFunctionBody(
    helpers,
    "gentype.Purchase convertToPurchase",
    `${flutterHelpersPath} convertToPurchase`,
  );
  if (!convertFunction) return;

  const sourceMap = extractBalancedAfterMarker(
    convertFunction.body,
    "final sourcePayload = normalizeDynamicMap(<String, dynamic>",
    "{",
    "}",
    `${flutterHelpersPath} canonical sourcePayload`,
    maskDartCommentsAndStrings,
  );
  if (!sourceMap) return;
  const sourceSegments = splitTopLevelSegments(
    sourceMap.body,
    maskDartCommentsAndStrings,
  );
  const originalIndex = sourceSegments.findIndex((segment) =>
    segment.includes("...originalJson"),
  );
  const itemIndex = sourceSegments.findIndex((segment) =>
    segment.includes("...itemJson"),
  );
  if (
    originalIndex < 0 ||
    itemIndex < 0 ||
    originalIndex >= itemIndex ||
    itemIndex !== sourceSegments.length - 1
  ) {
    fail(
      `${flutterHelpersPath} sourcePayload must merge legacy originalJson first and canonical itemJson last`,
    );
  }

  const mapBlocks = [];
  const mapMarker = "final map = <String, dynamic>";
  let offset = 0;
  while (offset < convertFunction.body.length) {
    const markerIndex = convertFunction.body.indexOf(mapMarker, offset);
    if (markerIndex < 0) break;
    const suffix = convertFunction.body.slice(markerIndex);
    const mapBlock = extractBalancedAfterMarker(
      suffix,
      mapMarker,
      "{",
      "}",
      `${flutterHelpersPath} convertToPurchase map`,
      maskDartCommentsAndStrings,
    );
    if (!mapBlock) break;
    mapBlocks.push(mapBlock.body);
    offset = markerIndex + mapBlock.end;
  }
  if (mapBlocks.length !== 2) {
    fail(
      `${flutterHelpersPath} convertToPurchase should declare exactly two platform maps, found ${mapBlocks.length}`,
    );
    return;
  }

  const normalizationKeys = new Set(["platform"]);
  for (const [index, type] of ["PurchaseAndroid", "PurchaseIOS"].entries()) {
    const segments = splitTopLevelSegments(
      mapBlocks[index],
      maskDartCommentsAndStrings,
    );
    if (segments[0] !== "...sourcePayload") {
      fail(
        `${flutterHelpersPath} ${type} map must start with ...sourcePayload`,
      );
    }
    const trailingSpread = segments
      .slice(1)
      .find((segment) => segment.startsWith("..."));
    if (trailingSpread) {
      fail(
        `${flutterHelpersPath} ${type} map must not overwrite normalized fields with ${trailingSpread}`,
      );
    }

    const entries = parseDartMapEntries(
      mapBlocks[index],
      `${flutterHelpersPath} ${type} map`,
    );
    for (const key of purchaseFields[type]) {
      if (!entries.has(key) || normalizationKeys.has(key)) continue;
      const sourceKey = firstCanonicalSourceReference(
        entries.get(key),
        convertFunction.body,
      );
      if (sourceKey !== key) {
        fail(
          `${flutterHelpersPath} ${type}.${key} override must read canonical sourcePayload['${key}'] first`,
        );
      }
    }
  }

  expectIncludes(
    "libraries/flutter_inapp_purchase/android/src/main/kotlin/io/github/hyochan/flutter_inapp_purchase/AndroidInappPurchasePlugin.kt",
    [
      "array.put(JSONObject(purchase.toJson()))",
      "val payload = JSONObject(p.toJson())",
      "val payload = JSONObject(purchase.toJson())",
    ],
    "Flutter Android native purchase serialization",
  );
  for (const applePluginPath of [
    "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
    "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
  ]) {
    expectIncludes(
      applePluginPath,
      [
        "OpenIapSerialization.purchase(purchase)",
        "FlutterIapHelper.purchasesRequired(purchases)",
      ],
      `${applePluginPath} native purchase serialization`,
    );
  }
}

function checkStrictAppleFrameworkQuerySerialization() {
  for (const [helperPath, helperName] of [
    ["libraries/react-native-iap/ios/RnIapHelper.swift", "RnIapHelper"],
    ["libraries/expo-iap/ios/ExpoIapHelper.swift", "ExpoIapHelper"],
    [
      "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapHelper.swift",
      "FlutterIapHelper",
    ],
    [
      "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterIapHelper.swift",
      "FlutterIapHelper",
    ],
    [
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIapHelper.swift",
      "GodotIapHelper",
    ],
  ]) {
    expectIncludes(
      helperPath,
      [
        "OpenIapSerialization.purchase(purchase)",
        "guard !encoded.isEmpty",
        ".billingResponseJsonParseError",
        // The bridge checks below require these helpers to be *called*. Assert
        // they are also *defined*, otherwise a bridge can reference a helper
        // that does not exist and the audit still passes while the Swift build
        // fails — which is exactly how `RnIapHelper.encodeRequired` shipped
        // missing.
        "static func encodeRequired",
        "static func purchasesRequired",
      ],
      `${helperName} strict native purchase serialization`,
    );
  }

  for (const [bridgePath, helperName] of [
    ["libraries/react-native-iap/ios/HybridRnIap.swift", "RnIapHelper"],
    ["libraries/expo-iap/ios/ExpoIapModule.swift", "ExpoIapHelper"],
    [
      "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
      "FlutterIapHelper",
    ],
    [
      "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
      "FlutterIapHelper",
    ],
    [
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
      "GodotIapHelper",
    ],
  ]) {
    expectIncludes(
      bridgePath,
      [`${helperName}.purchasesRequired(`],
      `${helperName} authoritative purchase-query routing`,
    );
    expectNotIncludes(
      bridgePath,
      [
        "OpenIapSerialization.purchasesRequired(",
        "OpenIapSerialization.encodeRequired(",
      ],
      `${helperName} published-native compatibility`,
    );
  }

  expectIncludes(
    "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
    [
      "// OpenIAP requestPurchase emits its canonical error exactly once",
      "code: ErrorCode.purchaseError.rawValue,\n                    message: error.localizedDescription,\n                    productId: productId",
    ],
    "Godot iOS request-purchase terminal error delivery",
  );
  expectIncludes(
    "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    [
      'if result.get("status", "") == "pending" or result.get("pending", false):\n\t\treturn null',
      'const APPLE_PLATFORMS := ["iOS", "macOS"]',
      "func _is_apple() -> bool:\n\treturn _platform in APPLE_PLATFORMS",
      'if _is_apple() and store != "apple":',
      'store not in ["google", "amazon", "horizon"]',
    ],
    "Godot pending dispatch and platform-scoped purchase decoding",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/BridgePayloadDecoder.cs",
    [
      "ios.Store is not IapStore.Apple",
      "android.Store != IapStore.Google",
      "android.Store != IapStore.Amazon",
      "android.Store != IapStore.Horizon",
    ],
    "MAUI platform-scoped authoritative purchase-list decoding",
  );
}

function checkReactNativePurchasePayloadContracts() {
  const generatedTypesPath = "packages/gql/src/generated/types.ts";
  const nitroSpecPath = "libraries/react-native-iap/src/specs/RnIap.nitro.ts";
  const typeBridgePath = "libraries/react-native-iap/src/utils/type-bridge.ts";
  const kotlinBridgePath =
    "libraries/react-native-iap/android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt";
  const swiftBridgePath = "libraries/react-native-iap/ios/RnIapHelper.swift";
  for (const relativePath of [
    generatedTypesPath,
    nitroSpecPath,
    typeBridgePath,
    kotlinBridgePath,
    swiftBridgePath,
  ]) {
    expectFile(relativePath);
  }
  if (
    !exists(generatedTypesPath) ||
    !exists(nitroSpecPath) ||
    !exists(typeBridgePath) ||
    !exists(kotlinBridgePath) ||
    !exists(swiftBridgePath)
  ) {
    return;
  }

  const generatedTypes = read(generatedTypesPath);
  const nitroSpec = read(nitroSpecPath);
  const typeBridge = read(typeBridgePath);
  const kotlinBridge = read(kotlinBridgePath);
  const swiftBridge = read(swiftBridgePath);
  const purchaseCommonFields = parseTypeScriptInterfaceFieldNames(
    generatedTypes,
    "PurchaseCommon",
    generatedTypesPath,
  );
  const canonicalFields = {
    PurchaseAndroid: [
      ...new Set([
        ...purchaseCommonFields,
        ...parseTypeScriptInterfaceFieldNames(
          generatedTypes,
          "PurchaseAndroid",
          generatedTypesPath,
        ),
      ]),
    ].sort(),
    PurchaseIOS: [
      ...new Set([
        ...purchaseCommonFields,
        ...parseTypeScriptInterfaceFieldNames(
          generatedTypes,
          "PurchaseIOS",
          generatedTypesPath,
        ),
      ]),
    ].sort(),
  };
  const canonicalUnion = [
    ...new Set(Object.values(canonicalFields).flat()),
  ].sort();
  const nitroFields = parseTypeScriptInterfaceFieldNames(
    nitroSpec,
    "NitroPurchase",
    nitroSpecPath,
  );
  const legacyTransportFields = [
    "purchaseStateAndroid",
    "purchaseTokenAndroid",
  ];
  expectSameSet(
    "React Native NitroPurchase transport fields",
    [...canonicalUnion, ...legacyTransportFields],
    nitroFields,
  );

  const converter = extractTypeScriptFunctionBody(
    typeBridge,
    "export function convertNitroPurchaseToPurchase",
    `${typeBridgePath} convertNitroPurchaseToPurchase`,
  );
  if (converter) {
    for (const [type, marker] of [
      ["PurchaseIOS", "const iosPurchase: PurchaseIOS ="],
      ["PurchaseAndroid", "const androidPurchase: PurchaseAndroid ="],
    ]) {
      const entries = parseTypeScriptObjectEntries(
        converter.body,
        marker,
        `${typeBridgePath} ${type} object`,
      );
      expectSameSet(
        `React Native convertNitroPurchaseToPurchase ${type} fields`,
        canonicalFields[type],
        [...entries.keys()],
      );
      for (const field of canonicalFields[type]) {
        const expression = entries.get(field) ?? "";
        const sourceKey = firstNitroPurchaseSourceReference(
          expression,
          converter.body,
        );
        if (sourceKey !== field) {
          fail(
            `${typeBridgePath} ${type}.${field} must read nitroPurchase.${field} first`,
          );
        }
        const allowedSources = new Set([field]);
        if (field === "purchaseState") {
          allowedSources.add("purchaseStateAndroid");
        }
        if (field === "purchaseToken") {
          allowedSources.add("purchaseTokenAndroid");
        }
        if (field === "autoRenewingAndroid") {
          allowedSources.add("isAutoRenewing");
        }
        if (field === "transactionId") {
          allowedSources.add("id");
          allowedSources.add("purchaseToken");
          allowedSources.add("purchaseTokenAndroid");
          allowedSources.add("store");
        }
        if (field === "userIdAmazon" || field === "userMarketplaceAmazon") {
          // The bridge nulls Amazon identity metadata unless store === amazon.
          allowedSources.add("store");
        }
        expectOnlySourceReferences(
          typeScriptMemberReferences(
            expression,
            "nitroPurchase",
            converter.body,
          ),
          allowedSources,
          `${typeBridgePath} ${type}.${field}`,
        );
      }
    }
  }

  const kotlinConverter = extractFunctionBody(
    kotlinBridge,
    "private fun convertToNitroPurchase",
    `${kotlinBridgePath} convertToNitroPurchase`,
  );
  if (kotlinConverter) {
    const entries = parseNamedCallArguments(
      kotlinConverter.body,
      "return NitroPurchase",
      "=",
      `${kotlinBridgePath} NitroPurchase constructor`,
    );
    expectSameSet(
      "React Native Android NitroPurchase constructor fields",
      nitroFields,
      [...entries.keys()],
    );
    for (const field of canonicalFields.PurchaseAndroid) {
      if (field === "platform") continue;
      const sourceKey = firstKotlinPurchaseSourceReference(
        entries.get(field) ?? "",
      );
      if (sourceKey !== field) {
        fail(
          `${kotlinBridgePath} NitroPurchase.${field} must read the matching native Purchase field`,
        );
      }
    }
  }

  const swiftConverter = extractFunctionBody(
    swiftBridge,
    "static func convertPurchaseDictionary",
    `${swiftBridgePath} convertPurchaseDictionary`,
  );
  if (swiftConverter) {
    const entries = parseNamedCallArguments(
      swiftConverter.body,
      "return NitroPurchase",
      ":",
      `${swiftBridgePath} NitroPurchase constructor`,
    );
    expectSameSet(
      "React Native iOS NitroPurchase constructor fields",
      nitroFields,
      [...entries.keys()],
    );
    for (const field of canonicalFields.PurchaseIOS) {
      if (field === "platform") continue;
      const expression = entries.get(field) ?? "";
      const sourceKey = firstSwiftDictionarySourceReference(
        expression,
        swiftConverter.body,
      );
      if (sourceKey !== field) {
        fail(
          `${swiftBridgePath} NitroPurchase.${field} must read dictionary["${field}"] first`,
        );
      }
      expectOnlySourceReferences(
        swiftDictionarySourceReferences(expression),
        new Set([field]),
        `${swiftBridgePath} NitroPurchase.${field}`,
      );
    }
  }
}

function checkReactNativeActiveSubscriptionPayloadContracts() {
  const generatedTypesPath = "packages/gql/src/generated/types.ts";
  const nitroSpecPath = "libraries/react-native-iap/src/specs/RnIap.nitro.ts";
  const indexPath = "libraries/react-native-iap/src/index.ts";
  const swiftBridgePath = "libraries/react-native-iap/ios/RnIapHelper.swift";
  for (const relativePath of [
    generatedTypesPath,
    nitroSpecPath,
    indexPath,
    swiftBridgePath,
  ]) {
    expectFile(relativePath);
  }
  if (
    !exists(generatedTypesPath) ||
    !exists(nitroSpecPath) ||
    !exists(indexPath) ||
    !exists(swiftBridgePath)
  ) {
    return;
  }

  const generatedTypes = read(generatedTypesPath);
  const nitroSpec = read(nitroSpecPath);
  const indexSource = read(indexPath);
  const swiftBridge = read(swiftBridgePath);
  const activeFields = parseTypeScriptInterfaceFieldNames(
    generatedTypes,
    "ActiveSubscription",
    generatedTypesPath,
  );
  const renewalFields = parseTypeScriptInterfaceFieldNames(
    generatedTypes,
    "RenewalInfoIOS",
    generatedTypesPath,
  );
  const nitroActiveFields = parseTypeScriptInterfaceFieldNames(
    nitroSpec,
    "NitroActiveSubscription",
    nitroSpecPath,
  );
  const nitroRenewalFields = parseTypeScriptInterfaceFieldNames(
    nitroSpec,
    "NitroRenewalInfoIOS",
    nitroSpecPath,
  );
  expectSameSet(
    "React Native NitroActiveSubscription transport fields",
    activeFields,
    nitroActiveFields,
  );
  expectSameSet(
    "React Native NitroRenewalInfoIOS transport fields",
    renewalFields,
    nitroRenewalFields,
  );

  const swiftActiveConverter = extractFunctionBody(
    swiftBridge,
    "static func convertActiveSubscriptionDictionary",
    `${swiftBridgePath} convertActiveSubscriptionDictionary`,
  );
  if (swiftActiveConverter) {
    const entries = parseNamedCallArguments(
      swiftActiveConverter.body,
      "return NitroActiveSubscription",
      ":",
      `${swiftBridgePath} NitroActiveSubscription constructor`,
    );
    expectSameSet(
      "React Native iOS NitroActiveSubscription constructor fields",
      nitroActiveFields,
      [...entries.keys()],
    );
    const androidOnlyFields = new Set([
      "autoRenewingAndroid",
      "basePlanIdAndroid",
      "purchaseTokenAndroid",
    ]);
    for (const field of activeFields) {
      if (androidOnlyFields.has(field)) continue;
      const expression = entries.get(field) ?? "";
      const sourceKey = firstSwiftDictionarySourceReference(
        expression,
        swiftActiveConverter.body,
      );
      if (sourceKey !== field) {
        fail(
          `${swiftBridgePath} NitroActiveSubscription.${field} must read dictionary["${field}"] first`,
        );
      }
      expectOnlySourceReferences(
        swiftDictionarySourceReferences(expression),
        new Set([field]),
        `${swiftBridgePath} NitroActiveSubscription.${field}`,
      );
    }
  }

  const swiftRenewalConverter = extractFunctionBody(
    swiftBridge,
    "static func convertRenewalInfoFromOpenIAP",
    `${swiftBridgePath} convertRenewalInfoFromOpenIAP`,
  );
  if (swiftRenewalConverter) {
    const entries = parseNamedCallArguments(
      swiftRenewalConverter.body,
      "return NitroRenewalInfoIOS",
      ":",
      `${swiftBridgePath} NitroRenewalInfoIOS constructor`,
    );
    expectSameSet(
      "React Native iOS NitroRenewalInfoIOS constructor fields",
      nitroRenewalFields,
      [...entries.keys()],
    );
    for (const field of renewalFields) {
      const expression = entries.get(field) ?? "";
      const sourceKey = firstSwiftDictionarySourceReference(
        expression,
        swiftRenewalConverter.body,
      );
      if (sourceKey !== field) {
        fail(
          `${swiftBridgePath} NitroRenewalInfoIOS.${field} must read dictionary["${field}"] first`,
        );
      }
      expectOnlySourceReferences(
        swiftDictionarySourceReferences(expression),
        new Set([field]),
        `${swiftBridgePath} NitroRenewalInfoIOS.${field}`,
      );
    }
  }

  const activeMapper = extractTypeScriptFunctionBody(
    indexSource,
    "export const getActiveSubscriptions",
    `${indexPath} getActiveSubscriptions`,
  );
  if (!activeMapper) return;
  const activeEntries = parseTypeScriptObjectEntries(
    activeMapper.body,
    "): ActiveSubscription => (",
    `${indexPath} ActiveSubscription object`,
  );
  expectSameSet("React Native getActiveSubscriptions fields", activeFields, [
    ...activeEntries.keys(),
  ]);
  for (const field of activeFields) {
    const expression = activeEntries.get(field) ?? "";
    if (!expression.includes(`sub.${field}`)) {
      fail(`${indexPath} ActiveSubscription.${field} must read sub.${field}`);
    }
    if (field !== "renewalInfoIOS") {
      const allowedSources = new Set([field]);
      if (field === "currentPlanId") allowedSources.add("productId");
      expectOnlySourceReferences(
        typeScriptMemberReferences(expression, "sub"),
        allowedSources,
        `${indexPath} ActiveSubscription.${field}`,
      );
    }
  }

  const renewalEntries = parseTypeScriptObjectEntries(
    activeMapper.body,
    "renewalInfoIOS: sub.renewalInfoIOS",
    `${indexPath} RenewalInfoIOS object`,
  );
  expectSameSet(
    "React Native getActiveSubscriptions RenewalInfoIOS fields",
    renewalFields,
    [...renewalEntries.keys()],
  );
  for (const field of renewalFields) {
    const expression = renewalEntries.get(field) ?? "";
    if (!expression.includes(`sub.renewalInfoIOS.${field}`)) {
      fail(
        `${indexPath} RenewalInfoIOS.${field} must read sub.renewalInfoIOS.${field}`,
      );
    }
    expectOnlySourceReferences(
      nestedTypeScriptMemberReferences(expression, "sub", "renewalInfoIOS"),
      new Set([field]),
      `${indexPath} RenewalInfoIOS.${field}`,
    );
  }
}

function checkKmpPurchasePayloadContracts() {
  const generatedTypesPath =
    "libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt";
  const helperPath =
    "libraries/kmp-iap/library/src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt";
  for (const relativePath of [generatedTypesPath, helperPath]) {
    expectFile(relativePath);
  }
  if (!exists(generatedTypesPath) || !exists(helperPath)) return;

  const generatedTypes = read(generatedTypesPath);
  const helper = read(helperPath);
  const purchaseFields = parseKotlinToJsonKeys(
    generatedTypes,
    "PurchaseAndroid",
    generatedTypesPath,
  );
  const mapper = extractFunctionBody(
    helper,
    "internal fun com.android.billingclient.api.Purchase.toPurchase",
    `${helperPath} Purchase.toPurchase`,
  );
  if (!mapper) return;

  const entries = parseNamedCallArguments(
    mapper.body,
    "return PurchaseAndroid",
    "=",
    `${helperPath} PurchaseAndroid constructor`,
  );
  expectMappedGeneratedFields(
    "KMP Android Purchase mapper fields",
    purchaseFields,
    entries,
    ["currentPlanId"],
  );
  const label = "KMP Android Purchase mapper";
  expectNamedExpression(entries, "dataAndroid", /^originalJson$/, label);
  expectNamedExpression(
    entries,
    "developerPayloadAndroid",
    /^developerPayload$/,
    label,
  );
  expectNamedExpression(entries, "purchaseToken", /^purchaseToken$/, label);
  expectNamedExpression(entries, "ids", /^products$/, label);
  expectNamedExpression(
    entries,
    "productId",
    /^products\.firstOrNull\(\) \?: ""$/,
    label,
  );
  expectNamedExpression(entries, "signatureAndroid", /^signature$/, label);
  expectNamedExpression(entries, "transactionId", /^orderId$/, label);
}

function checkGooglePurchasePayloadContracts() {
  const generatedTypesPath =
    "packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt";
  const mappers = [
    {
      path: "packages/google/openiap/src/play/java/dev/hyo/openiap/utils/BillingConverters.kt",
      marker: "fun BillingPurchase.toPurchase",
      label: "Google Play Purchase mapper",
      sourceExpressions: {
        dataAndroid: /^originalJson$/,
        developerPayloadAndroid: /^developerPayload$/,
        ids: /^products$/,
        productId: /^products\.firstOrNull\(\)\.orEmpty\(\)$/,
        purchaseToken: /^purchaseToken$/,
        signatureAndroid: /^signature$/,
        transactionId: /^orderId$/,
      },
    },
    {
      path: "packages/google/openiap/src/horizon/java/dev/hyo/openiap/utils/BillingConverters.kt",
      marker: "fun HorizonPurchase.toPurchase",
      label: "Google Horizon Purchase mapper",
      sourceExpressions: {
        dataAndroid: /^originalJson$/,
        developerPayloadAndroid: /^developerPayload$/,
        ids: /^productsList$/,
        productId: /^productsList\.firstOrNull\(\)\.orEmpty\(\)$/,
        purchaseToken: /^token$/,
        signatureAndroid: /^signature$/,
        transactionId:
          /^orderId\?\.takeIf \{ it\.isNotBlank\(\) \} \?: token$/,
      },
      intentionallyDefaultedFields: [
        "isSuspendedAndroid",
        "pendingPurchaseUpdateAndroid",
      ],
    },
    {
      path: "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      marker: "internal fun buildAmazonPurchase",
      label: "Google Amazon Purchase mapper",
      sourceExpressions: {
        currentPlanId:
          /^if \(isSubscription\) resolvedCurrentPlanId else null$/,
        dataAndroid: /^""$/,
        ids: /^listOf\(resolvedProductId\)$/,
        productId: /^resolvedProductId$/,
        purchaseToken: /^receiptId$/,
        signatureAndroid: /^null$/,
        transactionId: /^receiptId$/,
      },
      intentionallyDefaultedFields: [
        "developerPayloadAndroid",
        "obfuscatedAccountIdAndroid",
        "obfuscatedProfileIdAndroid",
      ],
    },
  ];
  expectFile(generatedTypesPath);
  for (const mapper of mappers) expectFile(mapper.path);
  if (
    !exists(generatedTypesPath) ||
    mappers.some((mapper) => !exists(mapper.path))
  ) {
    return;
  }

  const purchaseFields = parseKotlinToJsonKeys(
    read(generatedTypesPath),
    "PurchaseAndroid",
    generatedTypesPath,
  );
  for (const mapper of mappers) {
    const body = extractFunctionBody(
      read(mapper.path),
      mapper.marker,
      `${mapper.path} ${mapper.marker}`,
    );
    if (!body) continue;
    const entries = parseNamedCallArguments(
      body.body,
      "return PurchaseAndroid",
      "=",
      `${mapper.path} PurchaseAndroid constructor`,
    );
    expectMappedGeneratedFields(
      mapper.label,
      purchaseFields,
      entries,
      mapper.intentionallyDefaultedFields,
    );
    for (const [field, pattern] of Object.entries(mapper.sourceExpressions)) {
      expectNamedExpression(entries, field, pattern, mapper.label);
    }
  }
  expectIncludes(
    "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
    [
      "val resolvedCurrentPlanId = termSku?.takeIf { it.isNotBlank() } ?: resolvedProductId",
      "termSku = termSku",
      "): Boolean = !isCanceled && !hasCancelDate",
      "shouldIncludeAmazonReceipt(",
      "isCanceled = it.isCanceled",
      "hasCancelDate = it.cancelDate != null",
    ],
    "Google Amazon current-plan source mapping",
  );
  expectIncludes(
    "packages/google/openiap/src/testAmazon/java/dev/hyo/openiap/AmazonSubscriptionGroupMappingTest.kt",
    [
      "available purchases reject both Amazon cancellation signals",
      "isCanceled = true,\n                hasCancelDate = false",
      "isCanceled = false,\n                hasCancelDate = true",
    ],
    "Google Amazon cancellation filtering tests",
  );
  const amazonPath =
    "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt";
  const requestUpdates = extractFunctionBody(
    read(amazonPath),
    "private suspend fun requestPurchaseUpdates",
    `${amazonPath} requestPurchaseUpdates`,
  );
  if (requestUpdates) {
    const cancellationFilter = extractBalancedAfterMarker(
      requestUpdates.body,
      ".filter",
      "{",
      "}",
      `${amazonPath} available purchase cancellation filter`,
      maskKotlinCommentsAndStrings,
    );
    if (
      cancellationFilter &&
      !/^shouldIncludeAmazonReceipt\(\s*isCanceled = it\.isCanceled,\s*hasCancelDate = it\.cancelDate != null,\s*\)$/.test(
        normalizeExpression(cancellationFilter.body),
      )
    ) {
      fail(
        `${amazonPath} available purchase filter must exclusively use both Amazon cancellation signals`,
      );
    }
  }
}

function checkVegaPurchasePayloadContracts() {
  const generatedTypesPath = "packages/gql/src/generated/types.ts";
  expectFile(generatedTypesPath);
  if (!exists(generatedTypesPath)) return;
  const generatedTypes = read(generatedTypesPath);
  const purchaseAndroidFields = [
    ...new Set([
      ...parseTypeScriptInterfaceFieldNames(
        generatedTypes,
        "PurchaseCommon",
        generatedTypesPath,
      ),
      ...parseTypeScriptInterfaceFieldNames(
        generatedTypes,
        "PurchaseAndroid",
        generatedTypesPath,
      ),
    ]),
  ].sort();

  for (const { relativePath, transportFields } of [
    {
      relativePath: "libraries/react-native-iap/src/vega-adapter.ts",
      transportFields: ["purchaseStateAndroid", "purchaseTokenAndroid"],
    },
    {
      relativePath: "libraries/expo-iap/src/vega-adapter.ts",
      transportFields: [],
    },
  ]) {
    expectFile(relativePath);
    if (!exists(relativePath)) continue;
    const source = read(relativePath);
    const receiptInterface = extractBalancedAfterMarker(
      source,
      "interface VegaReceipt ",
      "{",
      "}",
      `${relativePath} VegaReceipt`,
      maskTypeScriptCommentsAndStrings,
    );
    const receiptFields = receiptInterface
      ? uniqueMatches(
          receiptInterface.body,
          /^\s*(?:readonly\s+)?([A-Za-z][A-Za-z0-9_]*)\??\s*:/gm,
        )
      : [];
    for (const field of ["deferredSku", "isDeferred", "termSku"]) {
      if (!receiptFields.includes(field)) {
        fail(`${relativePath} VegaReceipt must expose ${field}`);
      }
    }
    const mapper = extractTypeScriptFunctionBody(
      source,
      "function mapReceipt",
      `${relativePath} mapReceipt`,
    );
    if (!mapper) continue;
    const entries = parseTypeScriptObjectEntries(
      mapper.body,
      "return",
      `${relativePath} mapReceipt result`,
    );
    expectSameSet(
      `${relativePath} mapReceipt fields`,
      [...purchaseAndroidFields, ...transportFields],
      [...entries.keys()],
    );
    for (const field of ["id", "purchaseToken", "transactionId"]) {
      if (entries.get(field)?.trim() !== "receiptId") {
        fail(`${relativePath} mapReceipt.${field} must preserve receiptId`);
      }
    }
    if (!entries.get("ids")?.includes("productId")) {
      fail(`${relativePath} mapReceipt.ids must preserve productId`);
    }
    expectNamedExpression(
      entries,
      "currentPlanId",
      /^type === ['"]subs['"] \? \(nonBlankString\(receipt\.termSku\) \?\? productId\) : null$/,
      `${relativePath} mapReceipt`,
    );
    expectNamedExpression(
      entries,
      "isSuspendedAndroid",
      /^false$/,
      `${relativePath} mapReceipt`,
    );
    const pendingUpdate = normalizeExpression(
      entries.get("pendingPurchaseUpdateAndroid") ?? "",
    );
    const deferredSkuDeclaration = normalizeExpression(
      mapper.body.match(/\bconst\s+deferredSku\s*=\s*([^;]+);/)?.[1] ?? "",
    );
    if (
      !pendingUpdate.includes("receipt.isDeferred") ||
      !pendingUpdate.includes("deferredSku") ||
      deferredSkuDeclaration !== "nonBlankString(receipt.deferredSku)" ||
      pendingUpdate.includes("receipt.termSku")
    ) {
      fail(
        `${relativePath} mapReceipt.pendingPurchaseUpdateAndroid must use deferredSku for deferred changes`,
      );
    }
    const activeDeclaration = mapper.body.match(
      /\bconst\s+isActive\s*=\s*([^;]+);/,
    )?.[1];
    if (normalizeExpression(activeDeclaration ?? "") !== "!isCanceled") {
      fail(
        `${relativePath} mapReceipt must keep deferred subscriptions active until cancellation`,
      );
    }
    for (const field of [
      "isAutoRenewing",
      "autoRenewingAndroid",
      "purchaseState",
    ]) {
      if (!entries.get(field)?.includes("isActive")) {
        fail(`${relativePath} mapReceipt.${field} must derive from isActive`);
      }
    }
    const maskedSource = maskTypeScriptCommentsAndStrings(source);
    if (
      /if\s*\([^)]*\bisDeferred\b[^)]*\)\s*(?:return\s+false|continue)/.test(
        maskedSource,
      ) ||
      /!\s*receipt\.isDeferred/.test(maskedSource)
    ) {
      fail(
        `${relativePath} must not drop an active receipt merely because its plan change is deferred`,
      );
    }
    const availableMarker = relativePath.includes("react-native-iap")
      ? "const getAvailablePurchases = async"
      : "const getAvailableItems = async";
    const availableMapper = extractTypeScriptFunctionBody(
      source,
      availableMarker,
      `${relativePath} available purchase mapper`,
    );
    if (availableMapper) {
      const filterBody = extractBalancedAfterMarker(
        availableMapper.body,
        ".filter((receipt) =>",
        "{",
        "}",
        `${relativePath} available purchase filter`,
        maskTypeScriptCommentsAndStrings,
      );
      if (
        filterBody &&
        /\bisDeferred\b|\bdeferredSku\b/.test(
          maskTypeScriptCommentsAndStrings(filterBody.body),
        )
      ) {
        fail(
          `${relativePath} available purchase filter must not treat deferred plan changes as inactive`,
        );
      }
    }
  }
}

function checkPurchaseRoundTripRegressionCoverage() {
  expectIncludes(
    "libraries/godot-iap/Example/tests/test_types_only.gd",
    [
      'parsed.current_plan_id, "base-plan-monthly"',
      'parsed.data_android, "{\\"orderId\\":\\"txn-1\\"}"',
      "parsed.is_suspended_android, true",
      "parsed.pending_purchase_update_android.products[0]",
      "parsed.pending_purchase_update_android.purchase_token",
      'parsed.current_plan_id, "premium.monthly"',
      'parsed.offer_ios.id, "launch-offer"',
      "parsed.advanced_commerce_info_ios.request_reference_id",
      "parsed.advanced_commerce_info_ios.items[0].details.json_representation",
    ],
    "Godot canonical purchase round-trip regression coverage",
  );
}

function checkActiveSubscriptionFailureContracts() {
  expectIncludes(
    "packages/apple/Sources/OpenIapModule.swift",
    [
      "for await verification in Transaction.currentEntitlements {\n            let transaction = try checkVerified(verification)",
    ],
    "Apple active-subscription verification must be atomic",
  );
  expectIncludes(
    "packages/apple/Sources/OpenIapModule+ObjC.swift",
    [
      "let dictionaries = try subscriptions.map { try OpenIapSerialization.encodeRequired($0) }",
    ],
    "Apple active-subscription bridge serialization",
  );
  for (const [relativePath, needle] of [
    [
      "libraries/react-native-iap/ios/HybridRnIap.swift",
      "try subscriptions.map { try RnIapHelper.encodeRequired($0) }",
    ],
    [
      "libraries/expo-iap/ios/ExpoIapModule.swift",
      "ExpoIapHelper.sanitizeDictionary(try ExpoIapHelper.encodeRequired($0))",
    ],
    [
      "libraries/flutter_inapp_purchase/ios/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
      "try subscriptions.map { try FlutterIapHelper.encodeRequired($0) }",
    ],
    [
      "libraries/flutter_inapp_purchase/macos/flutter_inapp_purchase/Sources/flutter_inapp_purchase/FlutterInappPurchasePlugin.swift",
      "try subscriptions.map { try FlutterIapHelper.encodeRequired($0) }",
    ],
    [
      "libraries/godot-iap/ios-gdextension/Sources/GodotIap/GodotIap.swift",
      "try GodotIapHelper.encodeRequired($0)",
    ],
  ]) {
    expectIncludes(
      relativePath,
      [needle],
      `${relativePath} active-subscription serialization`,
    );
  }
  expectIncludes(
    "libraries/kmp-iap/library/src/iosMain/kotlin/io/github/hyochan/kmpiap/ProductPayloadNormalizerIOS.kt",
    [
      "internal fun decodeActiveSubscriptionListPayloadIOS(",
      'normalized["isActive"] !is Boolean',
      "!transactionDate.toDouble().isFinite()",
    ],
    "KMP active-subscription list decoding",
  );
  expectIncludes(
    "libraries/maui-iap/src/OpenIap.Maui/Platforms/iOS/OpenIapIOS.cs",
    [
      'operation: "getActiveSubscriptions"',
    ],
    "MAUI active-subscription list decoding",
  );
  expectIncludes(
    "libraries/godot-iap/addons/godot-iap/godot_iap.gd",
    [
      "func get_active_subscriptions_result(",
      "func has_active_subscriptions_result(",
      'not value.get("isActive") is bool',
    ],
    "Godot failure-aware active-subscription APIs",
  );
  expectIncludes(
    "libraries/godot-iap/android/src/main/java/dev/hyo/godotiap/GodotIap.kt",
    [
      "fun getActiveSubscriptionsResult(subscriptionIdsJson: String?): String",
      'put("success", false)',
      'put("code", code)',
    ],
    "Godot Android active-subscription result envelope",
  );
  expectIncludes(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    [
      "Unexpected active-subscription response type:",
      "Native active-subscription response contained malformed fields",
      "return activeSubscriptions.isNotEmpty;",
    ],
    "Flutter active-subscription failure propagation",
  );
  expectNotIncludes(
    "libraries/flutter_inapp_purchase/lib/flutter_inapp_purchase.dart",
    ["If there's an error getting subscriptions, return false"],
    "Flutter active-subscription failure propagation",
  );
}

export function collectPurchasePayloadParityFailures(repoRoot) {
  root = repoRoot;
  failures = [];
  checkFlutterPayloadContracts();
  checkStrictAppleFrameworkQuerySerialization();
  checkReactNativePurchasePayloadContracts();
  checkReactNativeActiveSubscriptionPayloadContracts();
  checkKmpPurchasePayloadContracts();
  checkGooglePurchasePayloadContracts();
  checkVegaPurchasePayloadContracts();
  checkPurchaseRoundTripRegressionCoverage();
  checkActiveSubscriptionFailureContracts();
  return [...failures];
}

export function inspectNamedArguments(
  source,
  marker,
  separator,
  language = "kotlin",
) {
  const previousFailures = failures;
  failures = [];
  const mask =
    language === "dart"
      ? maskDartCommentsAndStrings
      : language === "typescript"
        ? maskTypeScriptCommentsAndStrings
        : maskKotlinCommentsAndStrings;
  const entries = parseNamedCallArguments(
    source,
    marker,
    separator,
    "payload parser fixture",
    mask,
  );
  const issues = [...failures];
  failures = previousFailures;
  return { entries, issues };
}

export function inspectDartMapEntries(mapBody) {
  const previousFailures = failures;
  failures = [];
  const entries = parseDartMapEntries(mapBody, "Dart map fixture");
  const issues = [...failures];
  failures = previousFailures;
  return { entries, issues };
}

export function inspectMappedGeneratedFields(
  generatedFields,
  mappedFields,
  intentionallyDefaultedFields = [],
) {
  const previousFailures = failures;
  failures = [];
  expectMappedGeneratedFields(
    "generated field fixture",
    generatedFields,
    new Map(mappedFields.map((field) => [field, field])),
    intentionallyDefaultedFields,
  );
  const issues = [...failures];
  failures = previousFailures;
  return issues;
}

export function inspectFlutterCanonicalExpression(
  expression,
  functionBody = "",
) {
  const previousFailures = failures;
  failures = [];
  const sourceKey = firstCanonicalSourceReference(expression, functionBody);
  const issues = [...failures];
  failures = previousFailures;
  return { issues, sourceKey };
}

export {
  extractBalancedAfterMarker,
  maskKotlinCommentsAndStrings,
  maskTypeScriptCommentsAndStrings,
};
