// Conservatively reserve this identifier in minSdk 23 Android sources. This
// catches direct calls, static/aliased imports, and callable references without
// requiring a full Java/Kotlin type resolver. Comments and literal text remain
// valid because the scanner masks them before applying this check.
const API_24_CONCURRENT_KEY_SET = /(?:\bnewKeySet\b|`newKeySet`)/;

function translateJavaUnicodeEscapes(source) {
  // JLS §3.3: a raw backslash is eligible after an even contiguous run, or
  // when the previous result character itself came from a Unicode escape.
  let translated = "";
  let trailingBackslashes = 0;
  let lastResultWasUnicodeEscape = false;
  let index = 0;

  function append(character, fromUnicodeEscape) {
    translated += character;
    trailingBackslashes = character === "\\" ? trailingBackslashes + 1 : 0;
    lastResultWasUnicodeEscape = fromUnicodeEscape;
  }

  while (index < source.length) {
    const character = source[index];
    if (character !== "\\") {
      append(character, false);
      index += 1;
      continue;
    }

    const eligible =
      lastResultWasUnicodeEscape || trailingBackslashes % 2 === 0;
    const unicodeEscape = eligible
      ? /^\\u+([0-9a-fA-F]{4})/.exec(source.slice(index))
      : null;
    if (unicodeEscape) {
      append(String.fromCharCode(Number.parseInt(unicodeEscape[1], 16)), true);
      index += unicodeEscape[0].length;
      continue;
    }

    append(character, false);
    index += 1;
  }

  return translated;
}

function maskCommentsAndLiteralText(source, isKotlin) {
  const masked = Array.from(source, (character) =>
    character === "\n" || character === "\r" ? character : " ",
  );

  function skipLineComment(start) {
    let index = start + 2;
    while (
      index < source.length &&
      source[index] !== "\n" &&
      source[index] !== "\r"
    ) {
      index += 1;
    }
    return index;
  }

  function skipBlockComment(start) {
    let index = start + 2;
    let depth = 1;
    while (index < source.length && depth > 0) {
      if (isKotlin && source.startsWith("/*", index)) {
        depth += 1;
        index += 2;
      } else if (source.startsWith("*/", index)) {
        depth -= 1;
        index += 2;
      } else {
        index += 1;
      }
    }
    return index;
  }

  function scanString(start, delimiter, raw, interpolates) {
    let index = start + delimiter.length;
    while (index < source.length) {
      if (source.startsWith(delimiter, index)) {
        return index + delimiter.length;
      }
      if (!raw && source[index] === "\\") {
        index += 2;
        continue;
      }
      if (interpolates && source[index] === "$" && source[index + 1] === "{") {
        index = scanCode(index + 2, true);
        continue;
      }
      index += 1;
    }
    return source.length;
  }

  function scanCode(start, stopAtClosingBrace) {
    let index = start;
    let braceDepth = stopAtClosingBrace ? 1 : 0;
    while (index < source.length) {
      if (source.startsWith("//", index)) {
        index = skipLineComment(index);
        continue;
      }
      if (source.startsWith("/*", index)) {
        index = skipBlockComment(index);
        continue;
      }
      if (source.startsWith('"""', index)) {
        index = scanString(index, '"""', isKotlin, isKotlin);
        continue;
      }
      if (source[index] === '"') {
        index = scanString(index, '"', false, isKotlin);
        continue;
      }
      if (source[index] === "'") {
        index = scanString(index, "'", false, false);
        continue;
      }
      if (source[index] === "`") {
        // Kotlin backticks delimit executable identifiers. Preserve the exact
        // forbidden name while masking unrelated escaped-identifier text.
        const end = source.indexOf("`", index + 1);
        const closingIndex = end === -1 ? source.length - 1 : end;
        if (source.slice(index, closingIndex + 1) === "`newKeySet`") {
          for (
            let identifierIndex = index;
            identifierIndex <= closingIndex;
            identifierIndex += 1
          ) {
            masked[identifierIndex] = source[identifierIndex];
          }
        }
        index = closingIndex + 1;
        continue;
      }
      masked[index] = source[index];
      if (stopAtClosingBrace) {
        if (source[index] === "{") {
          braceDepth += 1;
        } else if (source[index] === "}") {
          braceDepth -= 1;
          if (braceDepth === 0) return index + 1;
        }
      }
      index += 1;
    }
    return index;
  }

  scanCode(0, false);
  return masked.join("");
}

export function usesApi24ConcurrentKeySet(source, isKotlin = true) {
  const lexicalSource = isKotlin ? source : translateJavaUnicodeEscapes(source);
  return API_24_CONCURRENT_KEY_SET.test(
    maskCommentsAndLiteralText(lexicalSource, isKotlin),
  );
}
