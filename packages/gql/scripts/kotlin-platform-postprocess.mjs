const PROFILES = Object.freeze({
  google: Object.freeze({
    packageName: 'dev.hyo.openiap',
    blankLineBeforePackage: false,
    validateEnumRoundTrips: true,
  }),
  kmp: Object.freeze({
    packageName: 'io.github.hyochan.kmpiap.openiap',
    blankLineBeforePackage: true,
    validateEnumRoundTrips: false,
  }),
});

function setPackage(source, { packageName, blankLineBeforePackage }) {
  const lines = source.split('\n');
  const packageIndices = [];
  const fileAnnotationIndices = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startsWith('package ')) packageIndices.push(index);
    if (lines[index].startsWith('@file:')) fileAnnotationIndices.push(index);
  }

  if (packageIndices.length > 1) {
    throw new Error(`Kotlin source contains multiple package declarations`);
  }

  if (packageIndices.length === 1) {
    const packageIndex = packageIndices[0];
    const lastFileAnnotation = fileAnnotationIndices.at(-1) ?? -1;
    if (packageIndex > lastFileAnnotation) {
      lines[packageIndex] = `package ${packageName}`;
      return lines.join('\n');
    }
    lines.splice(packageIndex, 1);
  }

  const insertionIndex = lines.reduce((last, line, index) => (line.startsWith('@file:') ? index : last), -1) + 1;
  const insertion = blankLineBeforePackage ? ['', `package ${packageName}`] : [`package ${packageName}`];
  lines.splice(insertionIndex, 0, ...insertion);
  return lines.join('\n');
}

function ensureEnumCompanionSemicolons(source) {
  return source.replace(/(\n\s*\w+\("[^"]*"\))\n\n(\s+companion object)/g, '$1;\n\n$2');
}

function rewriteGoogleEnumAliases(source) {
  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^\s*public\s+enum\s+class\s+(\w+)\s*\(\s*val\s+rawValue:\s*String\s*\)\s*\{\s*$/);
    if (!header) continue;

    const enumName = header[1];
    const constants = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const constant = lines[cursor].match(/^(\s*)(\w+)\("([^"]+)"\)(,|;)$/);
      if (constant) {
        const [, , name, rawValue] = constant;
        constants.push({ name, rawValue });
      }
      if (lines[cursor].trim().endsWith(';')) break;
      cursor += 1;
    }

    if (constants.length === 0 || cursor >= lines.length) {
      throw new Error(`Kotlin Google enum ${enumName} has no terminated raw-value constants`);
    }

    let whenIndex = cursor + 1;
    while (
      whenIndex < lines.length &&
      !/\bwhen\s*\(\s*value\s*\)/.test(lines[whenIndex]) &&
      !/^\s*public\s+(?:enum\s+)?class\s+/.test(lines[whenIndex])
    ) {
      whenIndex += 1;
    }
    if (whenIndex >= lines.length || !/\bwhen\s*\(\s*value\s*\)/.test(lines[whenIndex])) {
      throw new Error(`Kotlin Google enum ${enumName} is missing fromJson when(value) parsing`);
    }

    let elseIndex = whenIndex + 1;
    while (
      elseIndex < lines.length &&
      !/\belse\s*->/.test(lines[elseIndex]) &&
      !/^\s*public\s+(?:enum\s+)?class\s+/.test(lines[elseIndex])
    ) {
      elseIndex += 1;
    }
    if (elseIndex >= lines.length || !/\belse\s*->/.test(lines[elseIndex])) {
      throw new Error(`Kotlin Google enum ${enumName} is missing its fromJson else branch`);
    }

    let caseStart = whenIndex + 1;
    while (caseStart < elseIndex && lines[caseStart].trim().length === 0) {
      caseStart += 1;
    }
    if (caseStart >= elseIndex) {
      throw new Error(`Kotlin Google enum ${enumName} has no fromJson cases`);
    }

    const parsedCases = new Map();
    const constantNames = new Set(constants.map(({ name }) => name));
    for (const line of lines.slice(caseStart, elseIndex)) {
      if (!line.trim()) continue;
      const parsedCase = line.match(/^\s*"([^"]+)"\s*->\s*([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*$/);
      if (!parsedCase || parsedCase[2] !== enumName) {
        throw new Error(`Kotlin Google enum ${enumName} has an unsupported fromJson case: ${line.trim()}`);
      }
      const [, alias, , constantName] = parsedCase;
      if (!constantNames.has(constantName)) {
        throw new Error(`Kotlin Google enum ${enumName} maps alias "${alias}" to unknown constant ${constantName}`);
      }
      const prior = parsedCases.get(alias);
      if (prior && prior !== constantName) {
        throw new Error(`Kotlin Google enum ${enumName} maps alias "${alias}" to multiple constants`);
      }
      parsedCases.set(alias, constantName);
    }

    for (const { name, rawValue } of constants) {
      if (parsedCases.get(rawValue) !== name) {
        throw new Error(`Kotlin Google enum ${enumName}.${name} raw value "${rawValue}" does not round-trip through fromJson`);
      }
    }

    const caseIndent = lines[caseStart].match(/^(\s*)/)?.[1] ?? ' '.repeat(12);
    const rewrittenCases = [];
    for (const { name, rawValue } of constants) {
      const aliases = [
        rawValue,
        ...[...parsedCases.entries()].filter(([, constantName]) => constantName === name).map(([alias]) => alias),
        name,
      ];
      if (name.endsWith('Ios')) {
        aliases.push(`${name.slice(0, -3)}IOS`);
      }
      for (const alias of new Set(aliases)) {
        rewrittenCases.push(`${caseIndent}"${alias}" -> ${enumName}.${name}`);
      }
    }
    lines.splice(caseStart, elseIndex - caseStart, ...rewrittenCases);
  }

  return lines.join('\n');
}

function assertPostProcessed(source, profile) {
  const expectedPackage = `package ${PROFILES[profile].packageName}`;
  const packageLines = source.split('\n').filter((line) => line.startsWith('package '));
  if (packageLines.length !== 1 || packageLines[0] !== expectedPackage) {
    throw new Error(`Kotlin ${profile} output must contain exactly ${expectedPackage}`);
  }
  const lines = source.split('\n');
  const packageIndex = lines.indexOf(expectedPackage);
  const lastFileAnnotation = lines.reduce((last, line, index) => (line.startsWith('@file:') ? index : last), -1);
  if (lastFileAnnotation > packageIndex) {
    throw new Error(`Kotlin ${profile} output places a file annotation after its package`);
  }

  const missingSemicolon = source.match(
    /public enum class \w+\(val rawValue: String\) \{[\s\S]*?\n\s+\w+\("[^"]*"\)\n\n\s+companion object/,
  );
  if (missingSemicolon) {
    throw new Error(`Kotlin ${profile} output contains an enum companion without a semicolon`);
  }
}

export function postProcessKotlinSource(source, profile) {
  const options = PROFILES[profile];
  if (!options) {
    throw new Error(`Unknown Kotlin platform post-process profile: ${profile}`);
  }

  let result = setPackage(source, options);
  result = ensureEnumCompanionSemicolons(result);
  if (options.validateEnumRoundTrips) {
    result = rewriteGoogleEnumAliases(result);
  }
  if (!result.endsWith('\n')) result += '\n';
  assertPostProcessed(result, profile);
  return result;
}
