#!/usr/bin/env bun
/**
 * audit-docs.ts — SSOT consistency check for /docs/apis and /docs/types pages.
 *
 * What it does
 *   1. Walks every `packages/docs/src/pages/docs/apis/**\/*.tsx` and
 *      `packages/docs/src/pages/docs/types/**\/*.tsx` page.
 *   2. Loads the generated TypeScript SSOT from
 *      `packages/gql/src/generated/types.ts` and indexes every exported
 *      `interface` and object-shaped `type` alias field.
 *   3. For each doc page, extracts:
 *        - `<Link to="/docs/...">` targets
 *        - `<code>fieldName</code>` mentions inside `<table>` rows or
 *          `<ul className="api-params">` lists
 *      and cross-checks each against the type index.
 *   4. Reports drift as a punch-list (file:line — what's wrong).
 *   5. Checks release-note `Package Releases` lists so published package
 *      entries cannot silently lose their GitHub Release links.
 *   6. Checks docs-local version metadata against package/library SSOT files
 *      so `src/lib/versioning.ts` never drifts or imports outside the docs
 *      package root used by Vercel.
 *   7. Lints fenced active-doc code examples for a small set of recurring,
 *      language-specific phantom API patterns (release history excluded).
 *   8. Protects the canonical one-time and subscription offer pages (and their
 *      search entries) from being remapped to the platform-specific legacy
 *      pages or claiming enum members that are not in the generated schema.
 *
 * Exit code 0 = clean, 1 = at least one drift detected.
 *
 * Read knowledge/internal/07-docs-consistency.md for the rules this
 * script enforces.
 */
import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { GENERATED_SYNC_MANIFEST } from "../packages/gql/generated-sync-manifest.mjs";
import { assertSpecMatchesNativeFloor } from "./release-branch-policy.mjs";

const REPO_ROOT = resolve(import.meta.dir, "..");
const DOC_ROOTS = [
  resolve(REPO_ROOT, "packages/docs/src/pages/docs/apis"),
  resolve(REPO_ROOT, "packages/docs/src/pages/docs/types"),
];
const DOC_PAGES_DIR = resolve(REPO_ROOT, "packages/docs/src/pages");
const ACTIVE_DOCS_ROOT = resolve(REPO_ROOT, "packages/docs/src/pages/docs");
const TYPES_FILE = resolve(
  REPO_ROOT,
  GENERATED_SYNC_MANIFEST.typescript.source,
);
const RELEASE_NOTES_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/pages/docs/updates/releases.tsx",
);
const VERSIONING_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/lib/versioning.ts",
);
const DOC_VERSIONS_FILE = resolve(
  REPO_ROOT,
  "packages/docs/openiap-versions.json",
);
const ROOT_VERSIONS_FILE = resolve(REPO_ROOT, "openiap-versions.json");
const DOC_VERSION_METADATA_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/generated/version-metadata.json",
);
const DISCOUNT_OFFER_DOC_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/pages/docs/types/discount-offer.tsx",
);
const SUBSCRIPTION_OFFER_DOC_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/pages/docs/types/subscription-offer.tsx",
);
const SEARCH_DATA_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/lib/searchData.ts",
);
const VERIFY_PURCHASE_DOC_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/pages/docs/types/verify-purchase.tsx",
);
const HAS_ACTIVE_SUBSCRIPTIONS_DOC_FILE = resolve(
  REPO_ROOT,
  "packages/docs/src/pages/docs/apis/has-active-subscriptions.tsx",
);
const GENERATED_OFFER_TYPE_FILES = {
  typescript: TYPES_FILE,
  swift: resolve(REPO_ROOT, GENERATED_SYNC_MANIFEST.swift.source),
  kotlin: resolve(REPO_ROOT, GENERATED_SYNC_MANIFEST.kotlin.source),
  dart: resolve(REPO_ROOT, GENERATED_SYNC_MANIFEST.dart.source),
} as const;

type Drift = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

type SourceFile = {
  file: string;
  source: string;
};

export type CanonicalOfferDocsSources = {
  discountOffer: SourceFile;
  subscriptionOffer: SourceFile;
  searchData: SourceFile;
  generatedOfferTypes: Record<
    "typescript" | "swift" | "kotlin" | "dart",
    SourceFile
  >;
};

type CodeExampleRule = {
  language?: string;
  pattern: RegExp;
  message: string;
};

function requiredInterfaceFields(
  source: string,
  interfaceName: string,
): string[] {
  const sourceFile = ts.createSourceFile(
    "generated-types.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (
      !ts.isInterfaceDeclaration(statement) ||
      statement.name.text !== interfaceName
    )
      continue;
    return statement.members
      .filter(ts.isPropertySignature)
      .filter((member) => !member.questionToken && ts.isIdentifier(member.name))
      .map((member) => (member.name as ts.Identifier).text);
  }
  return [];
}

export function auditVerifyPurchaseDocs(
  file: string,
  source: string,
  generatedTypesSource: string,
): Drift[] {
  const section = (id: string, nextId?: string): string => {
    const start = source.indexOf(`id="${id}"`);
    if (start < 0) return "";
    const end = nextId
      ? source.indexOf(`id="${nextId}"`, start)
      : source.length;
    return source.slice(start, end < 0 ? source.length : end);
  };
  const ios = section(
    "verify-purchase-result-ios",
    "verify-purchase-result-android",
  );
  const android = section(
    "verify-purchase-result-android",
    "verify-purchase-result-horizon",
  );
  const horizon = section("verify-purchase-result-horizon");
  const drifts: Drift[] = [];
  const requiredFields = requiredInterfaceFields(
    generatedTypesSource,
    "VerifyPurchaseResultCommon",
  );
  if (requiredFields.length === 0) {
    return [
      {
        file: TYPES_FILE,
        line: 1,
        rule: "R14",
        message:
          "The generated TypeScript SSOT must declare required VerifyPurchaseResultCommon fields.",
      },
    ];
  }
  for (const [name, content] of [
    ["iOS", ios],
    ["Android", android],
    ["Horizon", horizon],
  ] as const) {
    const documentedFields = [
      ...content.matchAll(/<tr>\s*<td>\s*<code>([^<]+)<\/code>\s*<\/td>/g),
    ].map((match) => match[1]);
    for (const field of requiredFields) {
      const occurrences = documentedFields.filter(
        (documented) => documented === field,
      ).length;
      if (occurrences !== 1) {
        drifts.push({
          file,
          line: 1,
          rule: "R14",
          message: `${name} VerifyPurchaseResult docs must list the required ${field} field exactly once.`,
        });
      }
    }
  }
  const horizonSuccessRows = [
    ...horizon.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi),
  ]
    .map((match) => match[0])
    .filter((row) => /<code>\s*success\s*<\/code>/i.test(row));
  const horizonSuccessRow = horizonSuccessRows[0];
  if (
    horizonSuccessRows.length !== 1 ||
    !horizonSuccessRow ||
    !/deprecated/i.test(horizonSuccessRow) ||
    !/<code>\s*isValid\s*<\/code>/i.test(horizonSuccessRow)
  ) {
    drifts.push({
      file,
      line: 1,
      rule: "R14",
      message:
        "Horizon VerifyPurchaseResult docs must mark success as a deprecated isValid alias.",
    });
  }
  return drifts;
}

export function auditSubscriptionFailureDocs(
  file: string,
  source: string,
): Drift[] {
  const drifts: Drift[] = [];
  const renderedProse = collectRenderedProse(source);
  const obsoleteClaim =
    /React\s+Native's\s+root\s+helper\s+and\s+hook\s+map\s+failures\s+to\s+false/;
  const match = obsoleteClaim.exec(renderedProse.text);
  if (match) {
    drifts.push({
      file,
      line: lineNumberAt(
        source,
        renderedSourceOffset(renderedProse, match.index),
      ),
      rule: "R15",
      message:
        "React Native subscription queries reject; the hook calls onError before rethrowing.",
    });
  }

  const requiredClaims = [
    {
      pattern:
        /React\s+Native,\s*Expo,\s*and\s+native\s+promise\s+APIs\s+reject\s+on\s+failure/,
      message:
        "Subscription docs must state that React Native, Expo, and native promise APIs reject on failure.",
    },
    {
      pattern:
        /React\s+Native\s+and\s+Expo\s+hooks\s+call\s+onError\s+before\s+rethrowing/,
      message:
        "Subscription docs must state that React Native and Expo hooks call onError before rethrowing.",
    },
    {
      pattern:
        /Godot(?:'s)?\s+compatibility\s+boolean\s+helper\s+still\s+maps\s+failure\s+to\s+false/,
      message:
        "Subscription docs must identify Godot's compatibility boolean helper as the false fallback.",
    },
  ];

  for (const claim of requiredClaims) {
    if (!claim.pattern.test(renderedProse.text)) {
      drifts.push({ file, line: 1, rule: "R15", message: claim.message });
    }
  }

  return drifts;
}

const CODE_EXAMPLE_RULES: CodeExampleRule[] = [
  {
    language: "csharp",
    pattern: /@Deprecated|Task<(?:Boolean|String|List<)|\bList<String>\b/,
    message:
      "C# examples must use C# attributes and primitive/collection types (`[Obsolete]`, `bool`, `string`, `IReadOnlyList<T>`).",
  },
  {
    language: "csharp",
    pattern:
      /\?:\s*return|\bwhen\s*\(|(?:^|\n)\s*(?:else|null)\s*->|\?\.let\s*\{|\bprintln\s*\(/m,
    message: "C# example contains Kotlin syntax.",
  },
  {
    language: "dart",
    pattern:
      /\b(?:purchaseUpdatedStream|purchaseErrorStream|userChoiceBillingStream)\b/,
    message:
      "Flutter examples must use the current listener streams (`purchaseUpdatedListener`, `purchaseErrorListener`, or `userChoiceBillingAndroid`).",
  },
  {
    language: "dart",
    pattern: /\.finishTransaction\(\s*(?!purchase\s*:)[A-Za-z_]\w*\s*(?:,|\))/,
    message:
      "Flutter `finishTransaction` requires the named `purchase:` argument.",
  },
  {
    language: "typescript",
    pattern: /(?:^|\n)\s*await\s+(?:[A-Za-z_$][\w$]*\.)*initConnection\s*\(/m,
    message:
      "TypeScript examples must check the boolean returned by `initConnection` before store calls.",
  },
  {
    language: "dart",
    pattern: /(?:^|\n)\s*await\s+(?:[A-Za-z_$][\w$]*\.)*initConnection\s*\(/m,
    message:
      "Flutter examples must check the boolean returned by `initConnection` before store calls.",
  },
  {
    language: "kotlin",
    pattern: /(?:^|\n)\s*(?:[A-Za-z_]\w*\.)+initConnection\s*\(/m,
    message:
      "Kotlin and KMP examples must check the boolean returned by `initConnection` before store calls.",
  },
  {
    language: "csharp",
    pattern: /(?:^|\n)\s*await\s+[^;\n]*\.InitConnectionAsync\s*\(/m,
    message:
      "MAUI examples must check the boolean returned by `InitConnectionAsync` before store calls.",
  },
  {
    language: "gdscript",
    pattern: /(?:^|\n)\s*await\s+(?:[A-Za-z_]\w*\.)*init_connection\s*\(/m,
    message:
      "Godot examples must check the boolean returned by `init_connection` before store calls.",
  },
  {
    language: "typescript",
    pattern:
      /\b(?:purchaseUpdatedListener|purchaseErrorListener|userChoiceBillingListenerAndroid|developerProvidedBillingListenerAndroid|subscriptionBillingIssueListener)\s*\(\s*async\b/,
    message:
      "TypeScript event listeners must handle asynchronous work explicitly because listener return promises are not observed.",
  },
  {
    language: "typescript",
    pattern:
      /\b(?:onPurchaseSuccess|onPurchaseError|onError|onPromotedProductIOS|onUserChoiceBillingAndroid|onDeveloperProvidedBillingAndroid|onSubscriptionBillingIssue)\s*:\s*async\b/,
    message:
      "TypeScript hook callbacks must delegate asynchronous work to an explicitly handled promise.",
  },
  {
    language: "dart",
    pattern: /\.listen\s*\(\s*\([^)]*\)\s*async\b/,
    message:
      "Flutter stream listeners must handle asynchronous work explicitly because callback futures are not observed.",
  },
  {
    language: "csharp",
    pattern: /\.Subscribe\s*\(\s*async\b/,
    message:
      "MAUI observable listeners must delegate asynchronous work to a failure-handling task instead of using `async void`.",
  },
  {
    pattern: /OpenIapStore\.shared/,
    message:
      "Apple/native store examples must construct or inject `OpenIapStore`; no `shared` singleton exists.",
  },
  {
    pattern:
      /\b(?:verifyPurchase|verify_purchase)\b[\s\S]{0,400}\b(?:serverUrl|server_url)\b/,
    message:
      "`verifyPurchase` accepts platform verification options, not a Purchase plus server URL.",
  },
  {
    language: "typescript",
    pattern: /requestPurchase\(\{\s*(?:sku|purchaseToken|replacementMode)\s*:/,
    message:
      "TypeScript `requestPurchase` must use the `request` platform union and explicit `type`.",
  },
  {
    language: "swift",
    pattern: /\bsubscription\.remove\(\)/,
    message:
      "Swift listener tokens are removed with `OpenIapModule.shared.removeListener(subscription)`.",
  },
  {
    language: "gdscript",
    pattern:
      /\bvar\s+([A-Za-z_]\w*)\s*=\s*(?:Types\.)?RequestPurchaseProps\.new\(\)[\s\S]{0,200}\b\1\.sku\s*=/,
    message:
      "RequestPurchaseProps has no top-level sku; populate one request branch or use in_app().",
  },
  {
    language: "kotlin",
    pattern: /\.\s*requestPurchase\s*\(\s*(?:activity|props)\s*=/,
    message:
      "Kotlin and KMP `requestPurchase` accept one positional `RequestPurchaseProps` argument; `activity` and `props` are not parameters.",
  },
  {
    pattern:
      /(?:console\.log|println|print|Console\.WriteLine|Log\.[a-z]+)\([^)]{0,200}\b(?:offerToken|offer_token|OfferToken)\b/,
    message: "Offer tokens must not be written to application logs.",
  },
];

export function auditActiveCodeExampleSource(
  filePath: string,
  src: string,
): Drift[] {
  if (resolve(filePath) === RELEASE_NOTES_FILE) return [];

  const drifts: Drift[] = [];
  const blockRe =
    /<CodeBlock\b[^>]*\blanguage="([^"]+)"[^>]*>\s*\{`([\s\S]*?)`\}\s*<\/CodeBlock>/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(src)) !== null) {
    const language = blockMatch[1];
    const block = blockMatch[2];
    const auditedBlock =
      language === "kotlin" ? stripCommentsPreservingLayout(block) : block;
    const blockOffset = blockMatch.index + blockMatch[0].indexOf(block);

    for (const rule of CODE_EXAMPLE_RULES) {
      if (rule.language && rule.language !== language) continue;
      const violation = rule.pattern.exec(auditedBlock);
      if (!violation) continue;
      drifts.push({
        file: filePath,
        line: lineNumberAt(src, blockOffset + violation.index),
        rule: "R11",
        message: `${rule.message} (language: ${language})`,
      });
    }
  }
  return drifts;
}

function findSearchEntriesByTitle(
  source: string,
  title: string,
): { line: number; path: string | null; pathLine: number }[] {
  const entries: { line: number; path: string | null; pathLine: number }[] = [];
  const sourceFile = ts.createSourceFile(
    "searchData.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let apiData: ts.ArrayLiteralExpression | null = null;

  const unwrapExpression = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (true) {
      if (
        ts.isParenthesizedExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isTypeAssertionExpression(current) ||
        ts.isSatisfiesExpression(current)
      ) {
        current = current.expression;
        continue;
      }
      return current;
    }
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== "apiData" ||
        !declaration.initializer
      ) {
        continue;
      }
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrayLiteralExpression(initializer)) apiData = initializer;
    }
  }

  if (!apiData) return entries;

  const propertyName = (
    property: ts.ObjectLiteralElementLike,
  ): string | null => {
    if (!property.name) return null;
    if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
      return property.name.text;
    }
    return null;
  };
  const stringValue = (
    property: ts.ObjectLiteralElementLike,
  ): string | null => {
    if (!ts.isPropertyAssignment(property)) return null;
    const initializer = unwrapExpression(property.initializer);
    return ts.isStringLiteralLike(initializer) ? initializer.text : null;
  };

  for (const element of apiData.elements) {
    const entry = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(entry)) continue;
    const titleProperty = entry.properties.find(
      (property) => propertyName(property) === "title",
    );
    if (!titleProperty || stringValue(titleProperty) !== title) continue;
    const pathProperty = entry.properties.find(
      (property) => propertyName(property) === "path",
    );
    const line =
      sourceFile.getLineAndCharacterOfPosition(
        titleProperty.getStart(sourceFile),
      ).line + 1;
    entries.push({
      line,
      path: pathProperty ? stringValue(pathProperty) : null,
      pathLine: pathProperty
        ? sourceFile.getLineAndCharacterOfPosition(
            pathProperty.getStart(sourceFile),
          ).line + 1
        : line,
    });
  }

  return entries;
}

function parseTypeScriptDiscountOfferType(
  source: string,
): { index: number; members: string[] | null } | null {
  const sourceFile = ts.createSourceFile(
    "discount-offer-types.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "DiscountOfferType",
  );
  if (!declaration) return null;

  let offerType: ts.TypeNode = declaration.type;
  while (ts.isParenthesizedTypeNode(offerType)) offerType = offerType.type;
  const rawMembers = ts.isUnionTypeNode(offerType)
    ? offerType.types
    : [offerType];
  const members: string[] = [];
  for (const rawMember of rawMembers) {
    if (
      !ts.isLiteralTypeNode(rawMember) ||
      !ts.isStringLiteral(rawMember.literal)
    ) {
      return {
        index: declaration.getStart(sourceFile),
        members: null,
      };
    }
    members.push(rawMember.literal.text);
  }

  return {
    index: declaration.getStart(sourceFile),
    members,
  };
}

function findTypeScriptDiscountOfferType(
  source: string,
): { line: number; members: string[] | null } | null {
  const blockRe =
    /<CodeBlock\b[^>]*\blanguage="typescript"[^>]*>\s*\{`([\s\S]*?)`\}\s*<\/CodeBlock>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRe.exec(source)) !== null) {
    const block = blockMatch[1];
    const declaration = parseTypeScriptDiscountOfferType(block);
    if (!declaration) continue;

    return {
      line: lineNumberAt(
        source,
        blockMatch.index + blockMatch[0].indexOf(block) + declaration.index,
      ),
      members: declaration.members,
    };
  }

  return null;
}

type NamedOfferTypeLanguage = "swift" | "kotlin" | "dart";

function maskNativeNonCodePreservingLayout(
  source: string,
  maskStrings: boolean,
): string {
  const output = source.split("");
  let quote: "'" | '"' | null = null;
  let tripleQuoted = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      } else {
        output[i] = " ";
      }
      continue;
    }
    if (inBlockComment) {
      if (ch !== "\n") output[i] = " ";
      if (ch === "*" && next === "/") {
        output[i + 1] = " ";
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote !== null) {
      if (tripleQuoted && source.slice(i, i + 3) === quote.repeat(3)) {
        if (maskStrings) {
          output[i] = " ";
          output[i + 1] = " ";
          output[i + 2] = " ";
        }
        quote = null;
        tripleQuoted = false;
        i += 2;
        continue;
      }
      if (maskStrings && ch !== "\n") output[i] = " ";
      if (tripleQuoted) continue;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      tripleQuoted = source.slice(i, i + 3) === ch.repeat(3);
      if (maskStrings) {
        output[i] = " ";
        if (tripleQuoted) {
          output[i + 1] = " ";
          output[i + 2] = " ";
        }
      }
      if (tripleQuoted) i += 2;
      continue;
    }
    if (ch === "/" && next === "/") {
      output[i] = " ";
      output[i + 1] = " ";
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      output[i] = " ";
      output[i + 1] = " ";
      inBlockComment = true;
      i += 1;
    }
  }

  return output.join("");
}

function stripCommentsPreservingLayout(source: string): string {
  return maskNativeNonCodePreservingLayout(source, false);
}

function findMatchingBrace(
  source: string,
  openingBrace: number,
): number | null {
  let depth = 1;
  for (let i = openingBrace + 1; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] !== "}") continue;
    depth -= 1;
    if (depth === 0) return i;
  }
  return null;
}

function braceDepthAt(source: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth = Math.max(0, depth - 1);
  }
  return depth;
}

function findTopLevelMemberBoundary(
  source: string,
  language: NamedOfferTypeLanguage,
): number {
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
      continue;
    }
    if (source[i] === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    if (language === "dart" && source[i] === ";") return i;
    if (language === "kotlin" && /^companion\s+object\b/.test(source.slice(i)))
      return i;
  }
  return source.length;
}

function parseNamedDiscountOfferTypeMembers(
  source: string,
  language: NamedOfferTypeLanguage,
): { index: number; members: string[] | null } | null {
  const code = stripCommentsPreservingLayout(source);
  const structuralCode = maskNativeNonCodePreservingLayout(source, true);
  const declarationRe =
    language === "swift"
      ? /\benum\s+DiscountOfferType\b[^{}]*\{/g
      : language === "kotlin"
        ? /\benum\s+class\s+DiscountOfferType(?:\s*\([^)]*\))?\s*\{/g
        : /\benum\s+DiscountOfferType\s*\{/g;
  const declarations: { index: number; bodyStart: number; bodyEnd: number }[] =
    [];
  let declaration: RegExpExecArray | null;

  while ((declaration = declarationRe.exec(structuralCode)) !== null) {
    if (braceDepthAt(structuralCode, declaration.index) !== 0) continue;
    const openingBrace = declaration.index + declaration[0].lastIndexOf("{");
    const closingBrace = findMatchingBrace(structuralCode, openingBrace);
    if (closingBrace === null) {
      return { index: declaration.index, members: null };
    }
    declarations.push({
      index: declaration.index,
      bodyStart: openingBrace + 1,
      bodyEnd: closingBrace,
    });
  }
  if (declarations.length === 0) return null;
  if (declarations.length !== 1) {
    return { index: declarations[0].index, members: null };
  }

  const selected = declarations[0];
  const structuralBody = structuralCode.slice(
    selected.bodyStart,
    selected.bodyEnd,
  );
  const memberBoundary = findTopLevelMemberBoundary(structuralBody, language);

  const memberRe =
    language === "swift"
      ? /(?:\bcase|,)\s*([A-Za-z]\w*)\s*=\s*"([^"]+)"/g
      : language === "kotlin"
        ? /\b([A-Z]\w*)\s*\(\s*"([^"]+)"\s*\)/g
        : /\b([A-Z]\w*)\s*\(\s*(['"])([^'"]+)\2\s*\)/g;
  const memberSection = code.slice(
    selected.bodyStart,
    selected.bodyStart + memberBoundary,
  );
  const members = Array.from(
    memberSection.matchAll(memberRe),
    (match) => `${match[1]}=${match[language === "dart" ? 3 : 2]}`,
  );
  const unmatchedMembers =
    memberSection.replace(memberRe, "").replace(/[\s,;]/g, "").length > 0;

  return {
    index: selected.index,
    members: unmatchedMembers ? null : members,
  };
}

function findNamedDiscountOfferTypeMembers(
  source: string,
  language: NamedOfferTypeLanguage,
): { line: number; members: string[] | null } | null {
  const blockRe = new RegExp(
    `<CodeBlock\\b[^>]*\\blanguage="${language}"[^>]*>\\s*\\{\`([\\s\\S]*?)\`\\}\\s*</CodeBlock>`,
    "g",
  );
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRe.exec(source)) !== null) {
    const block = blockMatch[1];
    const declaration = parseNamedDiscountOfferTypeMembers(block, language);
    if (!declaration) continue;

    return {
      line: lineNumberAt(
        source,
        blockMatch.index + blockMatch[0].indexOf(block) + declaration.index,
      ),
      members: declaration.members,
    };
  }

  return null;
}

type RenderedProse = {
  text: string;
  segments: { outputStart: number; sourceStart: number; text: string }[];
};

/**
 * Extract only statically rendered JSX text. Native mapping claims must be
 * visible to readers, so comments, attributes, JavaScript strings, and
 * CodeBlock examples are deliberately excluded from the evidence.
 */
function collectRenderedProse(source: string): RenderedProse {
  const sourceFile = ts.createSourceFile(
    "offer-doc.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const segments: RenderedProse["segments"] = [];
  let outputLength = 0;

  const append = (text: string, sourceStart: number): void => {
    if (!text) return;
    if (segments.length > 0) outputLength += 1;
    segments.push({ outputStart: outputLength, sourceStart, text });
    outputLength += text.length;
  };

  const collectedComponents = new Set<ts.FunctionLikeDeclaration>();
  let resolveComponent: (
    expression: ts.Expression,
  ) => ts.FunctionLikeDeclaration | null;
  let collectFunction: (component: ts.FunctionLikeDeclaration) => void;

  const collectLocalComponent = (tagName: ts.JsxTagNameExpression): boolean => {
    if (!ts.isIdentifier(tagName)) return false;
    const component = resolveComponent(tagName);
    if (!component) return false;
    collectFunction(component);
    return true;
  };

  const collectJsx = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      if (node.openingElement.tagName.getText(sourceFile) === "CodeBlock") {
        return;
      }
      if (collectLocalComponent(node.openingElement.tagName)) return;
      for (const child of node.children) collectJsx(child);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sourceFile) === "CodeBlock") return;
      collectLocalComponent(node.tagName);
      return;
    }
    if (ts.isJsxFragment(node)) {
      for (const child of node.children) collectJsx(child);
      return;
    }
    if (ts.isJsxText(node)) {
      append(node.text, node.getStart(sourceFile));
      return;
    }
    if (ts.isJsxExpression(node) && node.expression) {
      let expression = node.expression;
      while (ts.isParenthesizedExpression(expression)) {
        expression = expression.expression;
      }
      if (ts.isStringLiteralLike(expression)) {
        append(expression.text, expression.getStart(sourceFile));
      } else if (
        ts.isJsxElement(expression) ||
        ts.isJsxSelfClosingElement(expression) ||
        ts.isJsxFragment(expression)
      ) {
        collectJsx(expression);
      }
    }
  };

  const unwrapRenderedExpression = (
    expression: ts.Expression,
  ): ts.Expression => {
    let current = expression;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };

  const collectExpression = (expression: ts.Expression): void => {
    const rendered = unwrapRenderedExpression(expression);
    if (
      ts.isJsxElement(rendered) ||
      ts.isJsxSelfClosingElement(rendered) ||
      ts.isJsxFragment(rendered)
    ) {
      collectJsx(rendered);
    } else if (ts.isConditionalExpression(rendered)) {
      collectExpression(rendered.whenTrue);
      collectExpression(rendered.whenFalse);
    }
  };

  collectFunction = (component: ts.FunctionLikeDeclaration): void => {
    if (collectedComponents.has(component)) return;
    collectedComponents.add(component);
    if (!component.body) return;
    if (!ts.isBlock(component.body)) {
      collectExpression(component.body);
      return;
    }

    const visitReturn = (node: ts.Node): void => {
      if (node !== component && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        collectExpression(node.expression);
        return;
      }
      ts.forEachChild(node, visitReturn);
    };
    visitReturn(component.body);
  };

  resolveComponent = (
    expression: ts.Expression,
  ): ts.FunctionLikeDeclaration | null => {
    const unwrapped = unwrapRenderedExpression(expression);
    if (ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) {
      return unwrapped;
    }
    if (ts.isCallExpression(unwrapped) && unwrapped.arguments.length > 0) {
      return resolveComponent(unwrapped.arguments[0]);
    }
    if (!ts.isIdentifier(unwrapped)) return null;

    for (const statement of sourceFile.statements) {
      if (
        ts.isFunctionDeclaration(statement) &&
        statement.name?.text === unwrapped.text
      ) {
        return statement;
      }
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === unwrapped.text &&
          declaration.initializer
        ) {
          return resolveComponent(declaration.initializer);
        }
      }
    }
    return null;
  };

  let component: ts.FunctionLikeDeclaration | null = null;
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
      ) &&
      statement.modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    ) {
      component = statement;
      break;
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      component = resolveComponent(statement.expression);
      break;
    }
  }
  if (component) collectFunction(component);

  return {
    text: segments.map((segment) => segment.text).join(" "),
    segments,
  };
}

function renderedSourceOffset(
  rendered: RenderedProse,
  outputOffset: number,
): number {
  const segment = [...rendered.segments]
    .reverse()
    .find((candidate) => candidate.outputStart <= outputOffset);
  if (!segment) return 0;
  return (
    segment.sourceStart +
    Math.min(outputOffset - segment.outputStart, segment.text.length)
  );
}

/**
 * Guard the semantics of the two canonical offer pages independently from the
 * generated-field audit. `DiscountOffer` is the Android one-time product
 * abstraction backed by `OneTimePurchaseOfferDetails`; subscription discounts
 * belong to `SubscriptionOffer`. Both types share `DiscountOfferType`, so stale
 * hand-written `WinBack` claims are particularly easy to reintroduce.
 *
 * Sources are injected to keep this check deterministic and fault-testable.
 */
export function auditCanonicalOfferDocs(
  sources: CanonicalOfferDocsSources,
): Drift[] {
  const drifts: Drift[] = [];
  const discount = sources.discountOffer;
  const subscription = sources.subscriptionOffer;
  const discountProse = collectRenderedProse(discount.source);
  const subscriptionProse = collectRenderedProse(subscription.source);

  if (!/\bOneTimePurchaseOfferDetails\b/.test(discountProse.text)) {
    drifts.push({
      file: discount.file,
      line: 1,
      rule: "R12",
      message:
        "DiscountOffer must reference the Android `ProductDetails.OneTimePurchaseOfferDetails` native source.",
    });
  }

  const oneTimeAndroidClaim =
    /\bone-time\b[\s\S]{0,240}\b(?:Android|Google Play)\b/i.test(
      discountProse.text,
    ) ||
    /\b(?:Android|Google Play)\b[\s\S]{0,240}\bone-time\b/i.test(
      discountProse.text,
    );
  if (!oneTimeAndroidClaim) {
    drifts.push({
      file: discount.file,
      line: 1,
      rule: "R12",
      message:
        "DiscountOffer must state that it represents one-time product offers on Android/Google Play.",
    });
  }

  const generatedTypeScriptOfferType = parseTypeScriptDiscountOfferType(
    sources.generatedOfferTypes.typescript.source,
  );
  const expectedOfferTypeMembers = generatedTypeScriptOfferType?.members;
  if (!expectedOfferTypeMembers) {
    drifts.push({
      file: sources.generatedOfferTypes.typescript.file,
      line: generatedTypeScriptOfferType
        ? lineNumberAt(
            sources.generatedOfferTypes.typescript.source,
            generatedTypeScriptOfferType.index,
          )
        : 1,
      rule: "R12",
      message:
        "The generated TypeScript SSOT must declare DiscountOfferType as a string-literal union.",
    });
  }

  const typeScriptOfferType = findTypeScriptDiscountOfferType(discount.source);
  const actualOfferTypeMembers = typeScriptOfferType?.members;
  const hasExactOfferTypeMembers =
    expectedOfferTypeMembers !== null &&
    expectedOfferTypeMembers !== undefined &&
    actualOfferTypeMembers !== null &&
    actualOfferTypeMembers !== undefined &&
    actualOfferTypeMembers.length === expectedOfferTypeMembers.length &&
    expectedOfferTypeMembers.every((member) =>
      actualOfferTypeMembers.includes(member),
    );
  if (expectedOfferTypeMembers && !hasExactOfferTypeMembers) {
    drifts.push({
      file: discount.file,
      line: typeScriptOfferType?.line ?? 1,
      rule: "R12",
      message: `The canonical DiscountOffer TypeScript snippet must declare DiscountOfferType with exactly the generated wire values ${formatQuotedList(expectedOfferTypeMembers ?? [])}.`,
    });
  }

  for (const language of ["swift", "kotlin", "dart"] as const) {
    const generatedSource = sources.generatedOfferTypes[language];
    const generatedDeclaration = parseNamedDiscountOfferTypeMembers(
      generatedSource.source,
      language,
    );
    const expectedMembers = generatedDeclaration?.members;
    if (!expectedMembers) {
      drifts.push({
        file: generatedSource.file,
        line: generatedDeclaration
          ? lineNumberAt(generatedSource.source, generatedDeclaration.index)
          : 1,
        rule: "R12",
        message: `The generated ${language} SSOT must declare DiscountOfferType members with explicit wire values.`,
      });
      continue;
    }

    const declaration = findNamedDiscountOfferTypeMembers(
      discount.source,
      language,
    );
    const actualMembers = declaration?.members;
    const hasExactMembers =
      actualMembers !== null &&
      actualMembers !== undefined &&
      actualMembers.length === expectedMembers.length &&
      expectedMembers.every((member) => actualMembers.includes(member));
    if (hasExactMembers) continue;

    drifts.push({
      file: discount.file,
      line: declaration?.line ?? 1,
      rule: "R12",
      message: `The canonical DiscountOffer ${language} snippet must declare exactly the generated DiscountOfferType members and wire values.`,
    });
  }

  const forbiddenDiscountClaims: {
    pattern: RegExp;
    message: string;
  }[] = [
    {
      pattern: /\bProduct\.SubscriptionOffer\b/,
      message:
        "DiscountOffer must not map to StoreKit Product.SubscriptionOffer; use the canonical SubscriptionOffer page for subscription discounts.",
    },
    {
      pattern: /\b(?:ProductDetails\.)?SubscriptionOfferDetails\b/,
      message:
        "DiscountOffer must not map to Play SubscriptionOfferDetails; it represents one-time product offers.",
    },
  ];
  if (
    expectedOfferTypeMembers &&
    !expectedOfferTypeMembers.includes("win-back")
  ) {
    forbiddenDiscountClaims.push({
      pattern: /\bWinBack\b/i,
      message:
        "DiscountOffer must not claim WinBack support; WinBack is not a generated DiscountOfferType member.",
    });
  }

  for (const claim of forbiddenDiscountClaims) {
    const match = claim.pattern.exec(discountProse.text);
    if (!match) continue;
    drifts.push({
      file: discount.file,
      line: lineNumberAt(
        discount.source,
        renderedSourceOffset(discountProse, match.index),
      ),
      rule: "R12",
      message: claim.message,
    });
  }

  const subscriptionWinBack = /\bWinBack\b/i.exec(subscriptionProse.text);
  if (
    subscriptionWinBack &&
    expectedOfferTypeMembers &&
    !expectedOfferTypeMembers.includes("win-back")
  ) {
    drifts.push({
      file: subscription.file,
      line: lineNumberAt(
        subscription.source,
        renderedSourceOffset(subscriptionProse, subscriptionWinBack.index),
      ),
      rule: "R12",
      message:
        "SubscriptionOffer must not claim WinBack support; WinBack is not a generated DiscountOfferType member.",
    });
  }

  for (const [pattern, nativeType] of [
    [/\bProduct\.SubscriptionOffer\b/, "Product.SubscriptionOffer"],
    [
      /\b(?:ProductDetails\.)?SubscriptionOfferDetails\b/,
      "ProductDetails.SubscriptionOfferDetails",
    ],
  ] as const) {
    if (pattern.test(subscriptionProse.text)) continue;
    drifts.push({
      file: subscription.file,
      line: 1,
      rule: "R12",
      message: `SubscriptionOffer must reference its native ${nativeType} source.`,
    });
  }

  for (const [title, expectedPath] of [
    ["DiscountOffer", "/docs/types/discount-offer"],
    ["SubscriptionOffer", "/docs/types/subscription-offer"],
  ] as const) {
    const entries = findSearchEntriesByTitle(sources.searchData.source, title);
    if (entries.length === 0) {
      drifts.push({
        file: sources.searchData.file,
        line: 1,
        rule: "R12",
        message: `Search data must include a canonical ${title} entry pointing to ${expectedPath}.`,
      });
      continue;
    }

    if (entries.length > 1) {
      drifts.push({
        file: sources.searchData.file,
        line: entries[1].line,
        rule: "R12",
        message: `Search data must contain exactly one canonical ${title} entry.`,
      });
    }

    for (const entry of entries) {
      if (entry.path === expectedPath) continue;
      drifts.push({
        file: sources.searchData.file,
        line: entry.pathLine,
        rule: "R12",
        message: `The canonical ${title} search entry must point to ${expectedPath}, not ${entry.path ?? "a missing path"}.`,
      });
    }
  }

  return drifts;
}

async function walkTsxFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
      } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
  }
  await recurse(root);
  return out;
}

/**
 * Collect every field declared by exported interfaces and object-shaped type
 * aliases in the generated TypeScript SSOT. Type names and literal unions are
 * intentionally not retained because the field audit only asks whether a
 * documented parameter exists on any generated shape.
 */
function buildKnownFields(): Set<string> {
  const src = readFileSync(TYPES_FILE, "utf8");
  const fields = new Set<string>();
  const sourceFile = ts.createSourceFile(
    TYPES_FILE,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;

    const members = ts.isInterfaceDeclaration(statement)
      ? statement.members
      : ts.isTypeAliasDeclaration(statement) &&
          ts.isTypeLiteralNode(statement.type)
        ? statement.type.members
        : undefined;
    if (!members) continue;

    for (const member of members) {
      if (!ts.isPropertySignature(member) || !member.name) continue;
      if (
        ts.isIdentifier(member.name) ||
        ts.isStringLiteral(member.name) ||
        ts.isNumericLiteral(member.name)
      ) {
        fields.add(member.name.text);
      }
    }
  }

  return fields;
}

/**
 * Parse a doc page's content for the things we want to audit.
 *
 * Field-name claims are scoped strictly to `<ul className="api-params">`
 * blocks — those are the only place a doc page formally asserts "this
 * is a real field on the type". Function names, native API references,
 * and listener names that appear inside ordinary <code>...</code> spans
 * elsewhere on the page are NOT validated (too many legitimate
 * non-field mentions to enumerate cleanly).
 */
function parseDocPage(filePath: string) {
  const src = readFileSync(filePath, "utf8");
  const lines = src.split("\n");

  const linkTargets: { line: number; href: string }[] = [];
  const fieldMentions: { line: number; field: string }[] = [];

  // Track whether we're inside an `<ul className="api-params">` block.
  // The first `<code>token</code>` of each `<li>` inside such a list is
  // treated as a field-name claim.
  let inParamsList = false;
  let liExpectingField = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;

    // <Link to="/docs/...">
    for (const m of line.matchAll(/<Link\s+to="(\/docs\/[^"]+)"/g)) {
      linkTargets.push({ line: lineNo, href: m[1] });
    }
    if (line.includes('className="api-params"')) inParamsList = true;
    if (inParamsList) {
      if (line.includes("</ul>")) {
        inParamsList = false;
        liExpectingField = false;
        continue;
      }
      if (/<li>/.test(line)) liExpectingField = true;
      if (liExpectingField) {
        const m = line.match(/<code>([^<']+?)<\/code>/);
        if (m) {
          const token = m[1].trim();
          // Allow dotted paths (`request.apple.sku`) and array-bracket
          // notation. Take the LEAF identifier — that's the field on
          // some intermediate type.
          const leaf = token.split(/[.[\s]/).pop() ?? token;
          if (
            /^[a-z_$][\w$]*$/.test(leaf) &&
            leaf.length > 1 &&
            !RESERVED_WORDS.has(leaf)
          ) {
            fieldMentions.push({ line: lineNo, field: leaf });
          }
          liExpectingField = false;
        }
      }
    }
  }

  return { linkTargets, fieldMentions };
}

const PACKAGE_RELEASE_ITEM_RE =
  /\b(?:openiap-(?:gql|apple|google)|react-native-iap|expo-iap|flutter_inapp_purchase|godot-iap|kmp-iap|maui-iap)\s+v?\d+\.\d+\.\d+(?:[-\w.]+)?\b/;
const GITHUB_RELEASE_LINK_RE =
  /href=["']https:\/\/github\.com\/hyodotdev\/openiap\/releases\/tag\/[^"']+["']/;

function lineNumberAt(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (src.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function formatQuotedList(values: string[]): string {
  const quoted = values.map((value) => `'${value}'`);
  if (quoted.length === 0) return "no generated values";
  if (quoted.length === 1) return quoted[0];
  if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`;
  return `${quoted.slice(0, -1).join(", ")}, and ${quoted.at(-1)}`;
}

/**
 * Released `Package Releases` blocks should link every package/version item to
 * the GitHub Release. If a workflow is still publishing, keep the heading as
 * `Planned Package Releases`; once it is changed to `Package Releases`, bare
 * package text is a docs regression.
 */
function auditReleaseNotePackageLinks(filePath: string): Drift[] {
  const src = readFileSync(filePath, "utf8");
  const drifts: Drift[] = [];
  const headingRe =
    /<h5[^>]*>\s*(Planned Package Releases|Package Releases)\s*<\/h5>/g;

  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRe.exec(src)) !== null) {
    const heading = headingMatch[1];
    const ulStart = src.indexOf("<ul", headingRe.lastIndex);
    if (ulStart === -1) continue;
    const ulEnd = src.indexOf("</ul>", ulStart);
    if (ulEnd === -1) continue;
    const ul = src.slice(ulStart, ulEnd);

    if (heading !== "Package Releases") continue;

    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRe.exec(ul)) !== null) {
      const item = liMatch[1];
      if (!PACKAGE_RELEASE_ITEM_RE.test(item)) continue;
      if (GITHUB_RELEASE_LINK_RE.test(item)) continue;

      drifts.push({
        file: filePath,
        line: lineNumberAt(src, ulStart + liMatch.index),
        rule: "R9",
        message:
          "`Package Releases` entries must link package/version items to their GitHub Release URL. Use `Planned Package Releases` only while a release is not published.",
      });
    }
  }

  return drifts;
}

function readJsonRecord(
  filePath: string,
  drifts: Drift[],
  rule: string,
  label: string,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      drifts.push({
        file: filePath,
        line: 1,
        rule,
        message: `${label} must contain a JSON object.`,
      });
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    drifts.push({
      file: filePath,
      line: 1,
      rule,
      message: `${label} could not be parsed as JSON: ${String(error)}`,
    });
    return null;
  }
}

function requireRegexValue(
  filePath: string,
  pattern: RegExp,
  drifts: Drift[],
  label: string,
): string | null {
  if (!statSyncSafe(filePath)) {
    drifts.push({
      file: filePath,
      line: 1,
      rule: "R10",
      message: `${label} source file is missing.`,
    });
    return null;
  }
  const source = readFileSync(filePath, "utf8");
  const value = source.match(pattern)?.[1]?.trim();
  if (!value) {
    drifts.push({
      file: filePath,
      line: 1,
      rule: "R10",
      message: `${label} source value was not found.`,
    });
    return null;
  }
  return value;
}

function requireJsonString(
  filePath: string,
  key: string,
  drifts: Drift[],
  label: string,
): string | null {
  const data = readJsonRecord(filePath, drifts, "R10", label);
  const value = data?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    drifts.push({
      file: filePath,
      line: 1,
      rule: "R10",
      message: `${label} missing "${key}" string.`,
    });
    return null;
  }
  return value;
}

function metadataKeyLine(source: string, key: string): number {
  const index = source.indexOf(`"${key}"`);
  return index === -1 ? 1 : lineNumberAt(source, index);
}

function auditVersionMetadata(): Drift[] {
  const drifts: Drift[] = [];

  const rootVersions = readJsonRecord(
    ROOT_VERSIONS_FILE,
    drifts,
    "R10",
    "openiap-versions.json",
  );
  const docsVersions = readJsonRecord(
    DOC_VERSIONS_FILE,
    drifts,
    "R10",
    "packages/docs/openiap-versions.json",
  );
  if (rootVersions) {
    try {
      assertSpecMatchesNativeFloor(rootVersions);
    } catch (error) {
      drifts.push({
        file: ROOT_VERSIONS_FILE,
        line: 1,
        rule: "R10",
        message:
          error instanceof Error
            ? error.message
            : "OpenIAP Spec must match the native version floor.",
      });
    }
  }
  if (rootVersions && docsVersions) {
    const rootJson = JSON.stringify(rootVersions);
    const docsJson = JSON.stringify(docsVersions);
    if (rootJson !== docsJson) {
      drifts.push({
        file: DOC_VERSIONS_FILE,
        line: 1,
        rule: "R10",
        message:
          "Docs openiap-versions.json must be a real synced copy of the root openiap-versions.json for Vercel.",
      });
    }
  }

  const metadata = readJsonRecord(
    DOC_VERSION_METADATA_FILE,
    drifts,
    "R10",
    "packages/docs/src/generated/version-metadata.json",
  );
  if (metadata) {
    const metadataSource = readFileSync(DOC_VERSION_METADATA_FILE, "utf8");
    const expected: Record<string, string | null> = {
      _generatedBy: "scripts/sync-versions.sh",
      expoPackageVersion: requireJsonString(
        resolve(REPO_ROOT, "libraries/expo-iap/package.json"),
        "version",
        drifts,
        "expo-iap package.json",
      ),
      reactNativePackageVersion: requireJsonString(
        resolve(REPO_ROOT, "libraries/react-native-iap/package.json"),
        "version",
        drifts,
        "react-native-iap package.json",
      ),
      flutterPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, "libraries/flutter_inapp_purchase/pubspec.yaml"),
        /^version:\s*(.+)$/m,
        drifts,
        "flutter_inapp_purchase pubspec.yaml version",
      ),
      godotPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, "libraries/godot-iap/addons/godot-iap/plugin.cfg"),
        /^version="([^"]+)"$/m,
        drifts,
        "godot-iap plugin.cfg version",
      ),
      kmpPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, "libraries/kmp-iap/gradle.properties"),
        /^libraryVersion=(.+)$/m,
        drifts,
        "kmp-iap libraryVersion",
      ),
      mauiPackageId: requireRegexValue(
        resolve(
          REPO_ROOT,
          "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        ),
        /<PackageId>([^<]+)<\/PackageId>/,
        drifts,
        "MAUI PackageId",
      ),
      mauiPackageVersion: requireRegexValue(
        resolve(
          REPO_ROOT,
          "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        ),
        /<PackageVersion>([^<]+)<\/PackageVersion>/,
        drifts,
        "MAUI PackageVersion",
      ),
      googleCompileSdk: requireRegexValue(
        resolve(REPO_ROOT, "packages/google/openiap/build.gradle.kts"),
        /compileSdk\s*=\s*(\d+)/,
        drifts,
        "openiap-google compileSdk",
      ),
      googleMinSdk: requireRegexValue(
        resolve(REPO_ROOT, "packages/google/openiap/build.gradle.kts"),
        /minSdk\s*=\s*(\d+)/,
        drifts,
        "openiap-google minSdk",
      ),
      googlePlayBillingVersion: requireRegexValue(
        resolve(REPO_ROOT, "packages/google/openiap/build.gradle.kts"),
        /val\s+playBillingVersion\s*=\s*"([^"]+)"/,
        drifts,
        "openiap-google Play Billing version",
      ),
      kmpCompileSdk: requireRegexValue(
        resolve(REPO_ROOT, "libraries/kmp-iap/gradle/libs.versions.toml"),
        /^android-compileSdk = "([^"]+)"/m,
        drifts,
        "kmp-iap android-compileSdk",
      ),
      kmpMinSdk: requireRegexValue(
        resolve(REPO_ROOT, "libraries/kmp-iap/gradle/libs.versions.toml"),
        /^android-minSdk = "([^"]+)"/m,
        drifts,
        "kmp-iap android-minSdk",
      ),
      kmpTargetSdk: requireRegexValue(
        resolve(REPO_ROOT, "libraries/kmp-iap/gradle/libs.versions.toml"),
        /^android-targetSdk = "([^"]+)"/m,
        drifts,
        "kmp-iap android-targetSdk",
      ),
    };

    for (const [key, expectedValue] of Object.entries(expected)) {
      if (expectedValue === null) continue;
      if (metadata[key] !== expectedValue) {
        drifts.push({
          file: DOC_VERSION_METADATA_FILE,
          line: metadataKeyLine(metadataSource, key),
          rule: "R10",
          message: `${key} must match the package/library SSOT value "${expectedValue}". Run ./scripts/sync-versions.sh.`,
        });
      }
    }
  }

  if (!statSyncSafe(VERSIONING_FILE)) {
    drifts.push({
      file: VERSIONING_FILE,
      line: 1,
      rule: "R10",
      message: "versioning.ts is missing.",
    });
    return drifts;
  }

  const source = readFileSync(VERSIONING_FILE, "utf8");
  if (!source.includes("../generated/version-metadata.json")) {
    drifts.push({
      file: VERSIONING_FILE,
      line: 1,
      rule: "R10",
      message:
        "versioning.ts must read framework package versions from generated version-metadata.json.",
    });
  }
  for (const forbidden of ["../../../../libraries/", "../../../../packages/"]) {
    const index = source.indexOf(forbidden);
    if (index !== -1) {
      drifts.push({
        file: VERSIONING_FILE,
        line: lineNumberAt(source, index),
        rule: "R10",
        message:
          "versioning.ts must not raw-import files outside packages/docs; Vercel deploys the docs package root.",
      });
    }
  }

  return drifts;
}

const RESERVED_WORDS = new Set([
  "true",
  "false",
  "null",
  "void",
  "any",
  "never",
  "string",
  "number",
  "boolean",
  "object",
  "undefined",
  "this",
  "self",
  "super",
  "async",
  "await",
  "yield",
  "try",
  "catch",
  "finally",
  "throw",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "const",
  "let",
  "var",
  "function",
  "class",
  "extends",
  "implements",
  "interface",
  "type",
  "enum",
  "public",
  "private",
  "protected",
  "static",
  "readonly",
  "abstract",
  "as",
  "is",
  "in",
  "of",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "import",
  "export",
  "from",
  "default",
  "package",
]);

/**
 * Verify a `/docs/<path>` link resolves to a real .tsx page (or its
 * containing folder's `index.tsx`).
 */
function linkResolves(target: string): boolean {
  const [pathPart] = target.split("#");
  // strip leading /docs and trailing slash
  const slug = pathPart.replace(/^\/docs\/?/, "").replace(/\/$/, "");
  if (!slug) return statSyncSafe(join(DOC_PAGES_DIR, "docs/index.tsx"));
  const candidates = [
    join(DOC_PAGES_DIR, "docs", `${slug}.tsx`),
    join(DOC_PAGES_DIR, "docs", slug, "index.tsx"),
  ];
  return candidates.some(statSyncSafe);
}

function statSyncSafe(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const drifts: Drift[] = [];

  // Build the set of every known field name across every type — used as
  // a lenient fallback for "is this field plausible?" checks. (We don't
  // know which type a `<code>foo</code>` mention belongs to without
  // page-level context, so we accept any field that exists somewhere in
  // types.ts.)
  const allFields = buildKnownFields();

  // Common framework + JS / Dart / Kotlin words that appear in code
  // examples without being IAP fields. Excluded from the fallback.
  const SAFE_WORDS = new Set([
    "console",
    "log",
    "error",
    "warn",
    "instance",
    "shared",
    "connected",
    "await",
    "use",
    "effect",
    "callback",
    "fn",
    "cb",
    "i",
    "j",
    "k",
    "p",
    "a",
    "b",
    "c",
    "x",
    "y",
    "value",
    "name",
    "message",
    "code",
    "reason",
    "data",
    "json",
    "token",
    "url",
    "sku",
    "id",
    "type",
    "platform",
    "native",
    "success",
    "result",
    "error",
    "props",
    "options",
    "params",
    "config",
    "request",
    "args",
    "purchase",
    "product",
    "subscription",
    // Top-level scalar/list function parameters. These legitimately appear
    // in API parameter lists but are not generated object fields.
    "program",
    "subscriptionIds",
    "tokenType",
    "groupId",
    "noticeType",
    "continued",
    "reconnect",
    "cancel",
    "open",
    "close",
    "state",
    "status",
    "group",
    "ok",
    "os",
    "isIOS",
    "isAndroid",
    "productId",
    "orderId",
    "transactionId",
    "purchaseToken",
    "currency",
    "price",
    "count",
    "index",
    "size",
    "length",
    "env",
    "process",
    "self",
    "this",
    "super",
    "continuation",
    "deferred",
    "completion",
    "handler",
    "listener",
    "emitter",
    "subscriber",
    "unsubscribe",
    "remove",
    "add",
  ]);

  const allDocPages: string[] = [];
  for (const root of DOC_ROOTS) {
    allDocPages.push(...(await walkTsxFiles(root)));
  }
  allDocPages.sort();

  for (const file of allDocPages) {
    const { linkTargets, fieldMentions } = parseDocPage(file);

    // R5 — internal /docs links must resolve.
    for (const { line, href } of linkTargets) {
      if (!linkResolves(href)) {
        drifts.push({
          file,
          line,
          rule: "R5",
          message: `<Link to="${href}"> does not resolve to an existing /docs page.`,
        });
      }
    }

    // R3 — field mentions should appear somewhere in the generated types.
    // We're lenient: if the mentioned word is in SAFE_WORDS or in any
    // type's field set, OK. Otherwise flag.
    for (const { line, field } of fieldMentions) {
      if (SAFE_WORDS.has(field)) continue;
      if (allFields.has(field)) continue;
      drifts.push({
        file,
        line,
        rule: "R3",
        message: `<code>${field}</code> is not a known field on any generated TypeScript type. Did you rename or invent it?`,
      });
    }
  }

  const activeDocPages = await walkTsxFiles(ACTIVE_DOCS_ROOT);
  for (const file of activeDocPages) {
    if (resolve(file) === RELEASE_NOTES_FILE) continue;
    drifts.push(
      ...auditActiveCodeExampleSource(file, readFileSync(file, "utf8")),
    );
  }

  drifts.push(...auditReleaseNotePackageLinks(RELEASE_NOTES_FILE));
  drifts.push(...auditVersionMetadata());
  drifts.push(
    ...auditVerifyPurchaseDocs(
      VERIFY_PURCHASE_DOC_FILE,
      readFileSync(VERIFY_PURCHASE_DOC_FILE, "utf8"),
      readFileSync(TYPES_FILE, "utf8"),
    ),
  );
  drifts.push(
    ...auditSubscriptionFailureDocs(
      HAS_ACTIVE_SUBSCRIPTIONS_DOC_FILE,
      readFileSync(HAS_ACTIVE_SUBSCRIPTIONS_DOC_FILE, "utf8"),
    ),
  );
  drifts.push(
    ...auditCanonicalOfferDocs({
      discountOffer: {
        file: DISCOUNT_OFFER_DOC_FILE,
        source: readFileSync(DISCOUNT_OFFER_DOC_FILE, "utf8"),
      },
      subscriptionOffer: {
        file: SUBSCRIPTION_OFFER_DOC_FILE,
        source: readFileSync(SUBSCRIPTION_OFFER_DOC_FILE, "utf8"),
      },
      searchData: {
        file: SEARCH_DATA_FILE,
        source: readFileSync(SEARCH_DATA_FILE, "utf8"),
      },
      generatedOfferTypes: {
        typescript: {
          file: GENERATED_OFFER_TYPE_FILES.typescript,
          source: readFileSync(GENERATED_OFFER_TYPE_FILES.typescript, "utf8"),
        },
        swift: {
          file: GENERATED_OFFER_TYPE_FILES.swift,
          source: readFileSync(GENERATED_OFFER_TYPE_FILES.swift, "utf8"),
        },
        kotlin: {
          file: GENERATED_OFFER_TYPE_FILES.kotlin,
          source: readFileSync(GENERATED_OFFER_TYPE_FILES.kotlin, "utf8"),
        },
        dart: {
          file: GENERATED_OFFER_TYPE_FILES.dart,
          source: readFileSync(GENERATED_OFFER_TYPE_FILES.dart, "utf8"),
        },
      },
    }),
  );

  // R5 (broken /docs links) is a hard failure; R3 (field name not in
  // generated types) is a warning because top-level scalar function
  // params (e.g. `sku: string`, `program: BillingProgramAndroid`)
  // legitimately appear in `<ul className="api-params">` lists without
  // being a field of any type — the audit can't tell them apart from
  // genuine drift without knowing each function's signature.
  const hardFailures = drifts.filter((d) => d.rule !== "R3");
  const warnings = drifts.filter((d) => d.rule === "R3");

  if (hardFailures.length === 0 && warnings.length === 0) {
    console.log("audit-docs: clean — 0 drift detected");
    process.exit(0);
  }

  if (warnings.length > 0) {
    console.log(`audit-docs: ${warnings.length} warning(s)\n`);
    for (const d of warnings) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    console.log("");
  }

  if (hardFailures.length > 0) {
    console.log(`audit-docs: ${hardFailures.length} drift(s) detected\n`);
    for (const d of hardFailures) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    process.exit(1);
  }

  console.log("audit-docs: no hard failures (warnings above are advisory)");
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("audit-docs: fatal error");
    console.error(err);
    process.exit(2);
  });
}
