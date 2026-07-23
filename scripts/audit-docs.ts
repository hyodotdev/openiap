#!/usr/bin/env bun
/**
 * audit-docs.ts — SSOT consistency check for /docs/apis and /docs/types pages.
 *
 * What it does
 *   1. Walks every `packages/docs/src/pages/docs/apis/**\/*.tsx` and
 *      `packages/docs/src/pages/docs/types/**\/*.tsx` page.
 *   2. Loads the generated TypeScript types from
 *      `libraries/expo-iap/src/types.ts` and indexes every `interface`,
 *      `type` alias, and `enum` / string-literal union shape.
 *   3. For each doc page, extracts:
 *        - `<Link to="/docs/...">` targets
 *        - `<code>fieldName</code>` mentions inside `<table>` rows or
 *          `<ul className="api-params">` lists
 *        - Enum-style `<code>'literal'</code>` mentions
 *        - `@see {@link …}` URLs
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
import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const DOC_ROOTS = [
  resolve(REPO_ROOT, 'packages/docs/src/pages/docs/apis'),
  resolve(REPO_ROOT, 'packages/docs/src/pages/docs/types'),
];
const DOC_PAGES_DIR = resolve(REPO_ROOT, 'packages/docs/src/pages');
const ACTIVE_DOCS_ROOT = resolve(REPO_ROOT, 'packages/docs/src/pages/docs');
const TYPES_FILE = resolve(REPO_ROOT, 'libraries/expo-iap/src/types.ts');
const RELEASE_NOTES_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/pages/docs/updates/releases.tsx'
);
const VERSIONING_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/lib/versioning.ts'
);
const DOC_VERSIONS_FILE = resolve(
  REPO_ROOT,
  'packages/docs/openiap-versions.json'
);
const ROOT_VERSIONS_FILE = resolve(REPO_ROOT, 'openiap-versions.json');
const DOC_VERSION_METADATA_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/generated/version-metadata.json'
);
const DISCOUNT_OFFER_DOC_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/pages/docs/types/discount-offer.tsx'
);
const SUBSCRIPTION_OFFER_DOC_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/pages/docs/types/subscription-offer.tsx'
);
const SEARCH_DATA_FILE = resolve(
  REPO_ROOT,
  'packages/docs/src/lib/searchData.ts'
);

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
};

type CodeExampleRule = {
  language?: string;
  pattern: RegExp;
  message: string;
};

const CODE_EXAMPLE_RULES: CodeExampleRule[] = [
  {
    language: 'csharp',
    pattern: /@Deprecated|Task<(?:Boolean|String|List<)|\bList<String>\b/,
    message:
      'C# examples must use C# attributes and primitive/collection types (`[Obsolete]`, `bool`, `string`, `IReadOnlyList<T>`).',
  },
  {
    language: 'csharp',
    pattern:
      /\?:\s*return|\bwhen\s*\(|(?:^|\n)\s*(?:else|null)\s*->|\?\.let\s*\{|\bprintln\s*\(/m,
    message: 'C# example contains Kotlin syntax.',
  },
  {
    language: 'dart',
    pattern:
      /\b(?:purchaseUpdatedStream|purchaseErrorStream|userChoiceBillingStream)\b/,
    message:
      'Flutter examples must use the current listener streams (`purchaseUpdatedListener`, `purchaseErrorListener`, or `userChoiceBillingAndroid`).',
  },
  {
    language: 'dart',
    pattern: /\.finishTransaction\(\s*(?!purchase\s*:)[A-Za-z_]\w*\s*(?:,|\))/,
    message:
      'Flutter `finishTransaction` requires the named `purchase:` argument.',
  },
  {
    pattern: /OpenIapStore\.shared/,
    message:
      'Apple/native store examples must construct or inject `OpenIapStore`; no `shared` singleton exists.',
  },
  {
    pattern:
      /\b(?:verifyPurchase|verify_purchase)\b[\s\S]{0,400}\b(?:serverUrl|server_url)\b/,
    message:
      '`verifyPurchase` accepts platform verification options, not a Purchase plus server URL.',
  },
  {
    language: 'typescript',
    pattern: /requestPurchase\(\{\s*(?:sku|purchaseToken|replacementMode)\s*:/,
    message:
      'TypeScript `requestPurchase` must use the `request` platform union and explicit `type`.',
  },
  {
    language: 'swift',
    pattern: /\bsubscription\.remove\(\)/,
    message:
      'Swift listener tokens are removed with `OpenIapModule.shared.removeListener(subscription)`.',
  },
  {
    language: 'gdscript',
    pattern:
      /\bvar\s+([A-Za-z_]\w*)\s*=\s*(?:Types\.)?RequestPurchaseProps\.new\(\)[\s\S]{0,200}\b\1\.sku\s*=/,
    message:
      'RequestPurchaseProps has no top-level sku; populate one request branch or use in_app().',
  },
  {
    language: 'kotlin',
    pattern:
      /\b(?:iapStore|kmpIAP)\.requestPurchase\s*\(\s*(?:activity|props)\s*=/,
    message:
      'Kotlin and KMP `requestPurchase` accept one positional `RequestPurchaseProps` argument; `activity` and `props` are not parameters.',
  },
  {
    pattern:
      /(?:console\.log|println|print|Console\.WriteLine|Log\.[a-z]+)\([^)]{0,200}\b(?:offerToken|offer_token|OfferToken)\b/,
    message: 'Offer tokens must not be written to application logs.',
  },
];

export function auditActiveCodeExampleSource(
  filePath: string,
  src: string
): Drift[] {
  if (resolve(filePath) === RELEASE_NOTES_FILE) return [];

  const drifts: Drift[] = [];
  const blockRe =
    /<CodeBlock\b[^>]*\blanguage="([^"]+)"[^>]*>\s*\{`([\s\S]*?)`\}\s*<\/CodeBlock>/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(src)) !== null) {
    const language = blockMatch[1];
    const block = blockMatch[2];
    const blockOffset = blockMatch.index + blockMatch[0].indexOf(block);

    for (const rule of CODE_EXAMPLE_RULES) {
      if (rule.language && rule.language !== language) continue;
      const violation = rule.pattern.exec(block);
      if (!violation) continue;
      drifts.push({
        file: filePath,
        line: lineNumberAt(src, blockOffset + violation.index),
        rule: 'R11',
        message: `${rule.message} (language: ${language})`,
      });
    }
  }
  return drifts;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEnclosingBraceBlock(
  source: string,
  index: number
): { body: string; bodyStart: number } | null {
  let openBraceIndex = source.lastIndexOf('{', index);
  while (openBraceIndex !== -1) {
    const body = extractBraceBlock(source, openBraceIndex);
    if (body !== null) {
      const closeBraceIndex = openBraceIndex + body.length + 1;
      if (index <= closeBraceIndex) {
        return { body, bodyStart: openBraceIndex + 1 };
      }
    }
    openBraceIndex = source.lastIndexOf('{', openBraceIndex - 1);
  }
  return null;
}

function findTopLevelSearchPath(
  objectBody: string
): { path: string; index: number } | null {
  const pathRe = /\bpath:\s*(['"])([^'"]+)\1/g;
  let pathMatch: RegExpExecArray | null;
  while ((pathMatch = pathRe.exec(objectBody)) !== null) {
    if (findEnclosingBraceBlock(objectBody, pathMatch.index)) continue;
    return { path: pathMatch[2], index: pathMatch.index };
  }
  return null;
}

function findSearchEntriesByTitle(
  source: string,
  title: string
): { line: number; path: string | null; pathLine: number }[] {
  const entries: { line: number; path: string | null; pathLine: number }[] = [];
  const titleRe = new RegExp(
    `\\btitle:\\s*(['"])${escapeRegExp(title)}\\1`,
    'g'
  );
  let titleMatch: RegExpExecArray | null;

  while ((titleMatch = titleRe.exec(source)) !== null) {
    const object = findEnclosingBraceBlock(source, titleMatch.index);
    const pathMatch = object ? findTopLevelSearchPath(object.body) : null;

    entries.push({
      line: lineNumberAt(source, titleMatch.index),
      path: pathMatch?.path ?? null,
      pathLine: object && pathMatch
        ? lineNumberAt(source, object.bodyStart + pathMatch.index)
        : lineNumberAt(source, titleMatch.index),
    });
  }

  return entries;
}

function findTypeScriptDiscountOfferType(
  source: string
): { line: number; members: string[] | null } | null {
  const blockRe =
    /<CodeBlock\b[^>]*\blanguage="typescript"[^>]*>\s*\{`([\s\S]*?)`\}\s*<\/CodeBlock>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRe.exec(source)) !== null) {
    const block = blockMatch[1];
    const declaration =
      /(?:export\s+)?type\s+DiscountOfferType\s*=\s*([\s\S]*?);/.exec(block);
    if (!declaration) continue;

    const rawMembers = declaration[1].split('|').map((member) => member.trim());
    const members: string[] = [];
    for (const rawMember of rawMembers) {
      const literal = /^(['"])([^'"]+)\1$/.exec(rawMember);
      if (!literal) {
        return {
          line: lineNumberAt(
            source,
            blockMatch.index + blockMatch[0].indexOf(block) + declaration.index
          ),
          members: null,
        };
      }
      members.push(literal[2]);
    }

    return {
      line: lineNumberAt(
        source,
        blockMatch.index + blockMatch[0].indexOf(block) + declaration.index
      ),
      members,
    };
  }

  return null;
}

type NamedOfferTypeLanguage = 'swift' | 'kotlin' | 'dart';

function findNamedDiscountOfferTypeMembers(
  source: string,
  language: NamedOfferTypeLanguage
): { line: number; members: string[] } | null {
  const blockRe = new RegExp(
    `<CodeBlock\\b[^>]*\\blanguage="${language}"[^>]*>\\s*\\{\`([\\s\\S]*?)\`\\}\\s*</CodeBlock>`,
    'g'
  );
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRe.exec(source)) !== null) {
    const block = blockMatch[1];
    const declaration =
      language === 'swift'
        ? /enum\s+DiscountOfferType[^{}]*\{([\s\S]*?)\}/.exec(block)
        : language === 'kotlin'
          ? /enum\s+class\s+DiscountOfferType(?:\([^)]*\))?\s*\{([\s\S]*?)\}/.exec(
              block
            )
          : /enum\s+DiscountOfferType\s*\{([\s\S]*?)\}/.exec(block);
    if (!declaration) continue;

    const memberRe =
      language === 'swift'
        ? /\bcase\s+([A-Za-z]\w*)\s*=\s*"([^"]+)"/g
        : language === 'kotlin'
          ? /\b([A-Z]\w*)\s*\(\s*"([^"]+)"\s*\)/g
          : /\b([A-Z]\w*)\s*\(\s*'([^']+)'\s*\)/g;
    const members = Array.from(declaration[1].matchAll(memberRe), (match) =>
      `${match[1]}=${match[2]}`
    );

    return {
      line: lineNumberAt(
        source,
        blockMatch.index + blockMatch[0].indexOf(block) + declaration.index
      ),
      members,
    };
  }

  return null;
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
  sources: CanonicalOfferDocsSources
): Drift[] {
  const drifts: Drift[] = [];
  const discount = sources.discountOffer;
  const subscription = sources.subscriptionOffer;

  if (!/\bOneTimePurchaseOfferDetails\b/.test(discount.source)) {
    drifts.push({
      file: discount.file,
      line: 1,
      rule: 'R12',
      message:
        'DiscountOffer must reference the Android `ProductDetails.OneTimePurchaseOfferDetails` native source.',
    });
  }

  const oneTimeAndroidClaim =
    /\bone-time\b[\s\S]{0,240}\b(?:Android|Google Play)\b/i.test(
      discount.source
    ) ||
    /\b(?:Android|Google Play)\b[\s\S]{0,240}\bone-time\b/i.test(
      discount.source
    );
  if (!oneTimeAndroidClaim) {
    drifts.push({
      file: discount.file,
      line: 1,
      rule: 'R12',
      message:
        'DiscountOffer must state that it represents one-time product offers on Android/Google Play.',
    });
  }

  const typeScriptOfferType = findTypeScriptDiscountOfferType(discount.source);
  const expectedOfferTypeMembers = ['introductory', 'promotional', 'one-time'];
  const actualOfferTypeMembers = typeScriptOfferType?.members;
  const hasExactOfferTypeMembers =
    actualOfferTypeMembers !== null &&
    actualOfferTypeMembers !== undefined &&
    actualOfferTypeMembers.length === expectedOfferTypeMembers.length &&
    expectedOfferTypeMembers.every((member) =>
      actualOfferTypeMembers.includes(member)
    );
  if (!hasExactOfferTypeMembers) {
    drifts.push({
      file: discount.file,
      line: typeScriptOfferType?.line ?? 1,
      rule: 'R12',
      message:
        "The canonical DiscountOffer TypeScript snippet must declare DiscountOfferType with exactly the generated wire values 'introductory', 'promotional', and 'one-time'.",
    });
  }

  for (const [language, expectedMembers] of [
    [
      'swift',
      [
        'introductory=introductory',
        'promotional=promotional',
        'oneTime=one-time',
      ],
    ],
    [
      'kotlin',
      [
        'Introductory=introductory',
        'Promotional=promotional',
        'OneTime=one-time',
      ],
    ],
    [
      'dart',
      [
        'Introductory=introductory',
        'Promotional=promotional',
        'OneTime=one-time',
      ],
    ],
  ] as const) {
    const declaration = findNamedDiscountOfferTypeMembers(
      discount.source,
      language
    );
    const actualMembers = declaration?.members;
    const hasExactMembers =
      actualMembers !== undefined &&
      actualMembers.length === expectedMembers.length &&
      expectedMembers.every((member) => actualMembers.includes(member));
    if (hasExactMembers) continue;

    drifts.push({
      file: discount.file,
      line: declaration?.line ?? 1,
      rule: 'R12',
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
        'DiscountOffer must not map to StoreKit Product.SubscriptionOffer; use the canonical SubscriptionOffer page for subscription discounts.',
    },
    {
      pattern: /\b(?:ProductDetails\.)?SubscriptionOfferDetails\b/,
      message:
        'DiscountOffer must not map to Play SubscriptionOfferDetails; it represents one-time product offers.',
    },
    {
      pattern: /\bWinBack\b/i,
      message:
        'DiscountOffer must not claim WinBack support; WinBack is not a DiscountOfferType enum member.',
    },
  ];

  for (const claim of forbiddenDiscountClaims) {
    const match = claim.pattern.exec(discount.source);
    if (!match) continue;
    drifts.push({
      file: discount.file,
      line: lineNumberAt(discount.source, match.index),
      rule: 'R12',
      message: claim.message,
    });
  }

  const subscriptionWinBack = /\bWinBack\b/i.exec(subscription.source);
  if (subscriptionWinBack) {
    drifts.push({
      file: subscription.file,
      line: lineNumberAt(subscription.source, subscriptionWinBack.index),
      rule: 'R12',
      message:
        'SubscriptionOffer must not claim WinBack support; WinBack is not a DiscountOfferType enum member.',
    });
  }

  for (const [pattern, nativeType] of [
    [/\bProduct\.SubscriptionOffer\b/, 'Product.SubscriptionOffer'],
    [
      /\b(?:ProductDetails\.)?SubscriptionOfferDetails\b/,
      'ProductDetails.SubscriptionOfferDetails',
    ],
  ] as const) {
    if (pattern.test(subscription.source)) continue;
    drifts.push({
      file: subscription.file,
      line: 1,
      rule: 'R12',
      message: `SubscriptionOffer must reference its native ${nativeType} source.`,
    });
  }

  for (const [title, expectedPath] of [
    ['DiscountOffer', '/docs/types/discount-offer'],
    ['SubscriptionOffer', '/docs/types/subscription-offer'],
  ] as const) {
    const entries = findSearchEntriesByTitle(sources.searchData.source, title);
    if (entries.length === 0) {
      drifts.push({
        file: sources.searchData.file,
        line: 1,
        rule: 'R12',
        message: `Search data must include a canonical ${title} entry pointing to ${expectedPath}.`,
      });
      continue;
    }

    if (entries.length > 1) {
      drifts.push({
        file: sources.searchData.file,
        line: entries[1].line,
        rule: 'R12',
        message: `Search data must contain exactly one canonical ${title} entry.`,
      });
    }

    for (const entry of entries) {
      if (entry.path === expectedPath) continue;
      drifts.push({
        file: sources.searchData.file,
        line: entry.pathLine,
        rule: 'R12',
        message: `The canonical ${title} search entry must point to ${expectedPath}, not ${entry.path ?? 'a missing path'}.`,
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
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  }
  await recurse(root);
  return out;
}

/**
 * Build an index of every interface / type alias / enum-like union
 * defined in libraries/expo-iap/src/types.ts.
 *
 * The index maps:
 *   typeName: string  →  { fields: Set<string>, literals: Set<string> }
 *
 * Fields = property names declared inside `interface X { ... }` or
 *          `type X = { ... }`. Optional `?` is stripped.
 * Literals = string-literal members of a union type
 *            (`type X = 'a' | 'b' | 'c'`).
 */
function buildTypeIndex(): Map<
  string,
  { fields: Set<string>; literals: Set<string> }
> {
  const src = readFileSync(TYPES_FILE, 'utf8');
  const index = new Map<
    string,
    { fields: Set<string>; literals: Set<string> }
  >();

  // interface NAME { ... } — capture body via brace matching
  const interfaceRe =
    /export\s+interface\s+([A-Za-z_]\w*)\s*(?:extends[^{]+)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = interfaceRe.exec(src)) !== null) {
    const name = m[1];
    const body = extractBraceBlock(src, m.index + m[0].length - 1);
    if (!body) continue;
    const fields = extractInterfaceFields(body);
    index.set(name, {
      fields,
      literals: new Set(),
    });
  }

  // type NAME = '...' | '...' | ... — string-literal unions
  const literalUnionRe =
    /export\s+type\s+([A-Za-z_]\w*)\s*=\s*((?:'[^']*'\s*\|\s*)*'[^']*')\s*;/g;
  while ((m = literalUnionRe.exec(src)) !== null) {
    const name = m[1];
    const literals = new Set<string>();
    for (const lit of m[2].matchAll(/'([^']*)'/g)) literals.add(lit[1]);
    index.set(name, {
      fields: new Set(),
      literals,
    });
  }

  // type NAME = { ... } — object-shape aliases
  const objectAliasRe = /export\s+type\s+([A-Za-z_]\w*)\s*=\s*\{/g;
  while ((m = objectAliasRe.exec(src)) !== null) {
    const name = m[1];
    if (index.has(name)) continue;
    const body = extractBraceBlock(src, m.index + m[0].length - 1);
    if (!body) continue;
    index.set(name, {
      fields: extractInterfaceFields(body),
      literals: new Set(),
    });
  }

  return index;
}

function extractBraceBlock(src: string, openBraceIdx: number): string | null {
  if (src[openBraceIdx] !== '{') return null;
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return src.slice(openBraceIdx + 1, i - 1);
}

function extractInterfaceFields(body: string): Set<string> {
  const fields = new Set<string>();
  // Match `name?:` or `name:` at the start of a line (after whitespace
  // or `;`). Skip lines starting with `//` (comments).
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*'))
      continue;
    const fieldMatch = trimmed.match(/^([a-z_$][\w$]*)\s*\??\s*:/i);
    if (fieldMatch) fields.add(fieldMatch[1]);
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
  const src = readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  const linkTargets: { line: number; href: string }[] = [];
  const seeUrls: { line: number; url: string }[] = [];
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
    // @see {@link https://openiap.dev/...}
    for (const m of line.matchAll(
      /@see\s*\{@link\s+(https:\/\/www\.openiap\.dev\/[^\s}]+)\}/g
    )) {
      seeUrls.push({ line: lineNo, url: m[1] });
    }

    if (line.includes('className="api-params"')) inParamsList = true;
    if (inParamsList) {
      if (line.includes('</ul>')) {
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

  return { linkTargets, seeUrls, fieldMentions };
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

/**
 * Released `Package Releases` blocks should link every package/version item to
 * the GitHub Release. If a workflow is still publishing, keep the heading as
 * `Planned Package Releases`; once it is changed to `Package Releases`, bare
 * package text is a docs regression.
 */
function auditReleaseNotePackageLinks(filePath: string): Drift[] {
  const src = readFileSync(filePath, 'utf8');
  const drifts: Drift[] = [];
  const headingRe =
    /<h5[^>]*>\s*(Planned Package Releases|Package Releases)\s*<\/h5>/g;

  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRe.exec(src)) !== null) {
    const heading = headingMatch[1];
    const ulStart = src.indexOf('<ul', headingRe.lastIndex);
    if (ulStart === -1) continue;
    const ulEnd = src.indexOf('</ul>', ulStart);
    if (ulEnd === -1) continue;
    const ul = src.slice(ulStart, ulEnd);

    if (heading !== 'Package Releases') continue;

    const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/g;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRe.exec(ul)) !== null) {
      const item = liMatch[1];
      if (!PACKAGE_RELEASE_ITEM_RE.test(item)) continue;
      if (GITHUB_RELEASE_LINK_RE.test(item)) continue;

      drifts.push({
        file: filePath,
        line: lineNumberAt(src, ulStart + liMatch.index),
        rule: 'R9',
        message:
          '`Package Releases` entries must link package/version items to their GitHub Release URL. Use `Planned Package Releases` only while a release is not published.',
      });
    }
  }

  return drifts;
}

function readJsonRecord(
  filePath: string,
  drifts: Drift[],
  rule: string,
  label: string
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
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
  label: string
): string | null {
  if (!statSyncSafe(filePath)) {
    drifts.push({
      file: filePath,
      line: 1,
      rule: 'R10',
      message: `${label} source file is missing.`,
    });
    return null;
  }
  const source = readFileSync(filePath, 'utf8');
  const value = source.match(pattern)?.[1]?.trim();
  if (!value) {
    drifts.push({
      file: filePath,
      line: 1,
      rule: 'R10',
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
  label: string
): string | null {
  const data = readJsonRecord(filePath, drifts, 'R10', label);
  const value = data?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    drifts.push({
      file: filePath,
      line: 1,
      rule: 'R10',
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
    'R10',
    'openiap-versions.json'
  );
  const docsVersions = readJsonRecord(
    DOC_VERSIONS_FILE,
    drifts,
    'R10',
    'packages/docs/openiap-versions.json'
  );
  if (rootVersions && docsVersions) {
    const rootJson = JSON.stringify(rootVersions);
    const docsJson = JSON.stringify(docsVersions);
    if (rootJson !== docsJson) {
      drifts.push({
        file: DOC_VERSIONS_FILE,
        line: 1,
        rule: 'R10',
        message:
          'Docs openiap-versions.json must be a real synced copy of the root openiap-versions.json for Vercel.',
      });
    }
  }

  const metadata = readJsonRecord(
    DOC_VERSION_METADATA_FILE,
    drifts,
    'R10',
    'packages/docs/src/generated/version-metadata.json'
  );
  if (metadata) {
    const metadataSource = readFileSync(DOC_VERSION_METADATA_FILE, 'utf8');
    const expected: Record<string, string | null> = {
      _generatedBy: 'scripts/sync-versions.sh',
      expoPackageVersion: requireJsonString(
        resolve(REPO_ROOT, 'libraries/expo-iap/package.json'),
        'version',
        drifts,
        'expo-iap package.json'
      ),
      reactNativePackageVersion: requireJsonString(
        resolve(REPO_ROOT, 'libraries/react-native-iap/package.json'),
        'version',
        drifts,
        'react-native-iap package.json'
      ),
      flutterPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/flutter_inapp_purchase/pubspec.yaml'),
        /^version:\s*(.+)$/m,
        drifts,
        'flutter_inapp_purchase pubspec.yaml version'
      ),
      godotPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/godot-iap/addons/godot-iap/plugin.cfg'),
        /^version="([^"]+)"$/m,
        drifts,
        'godot-iap plugin.cfg version'
      ),
      kmpPackageVersion: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/kmp-iap/gradle.properties'),
        /^libraryVersion=(.+)$/m,
        drifts,
        'kmp-iap libraryVersion'
      ),
      mauiPackageId: requireRegexValue(
        resolve(
          REPO_ROOT,
          'libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj'
        ),
        /<PackageId>([^<]+)<\/PackageId>/,
        drifts,
        'MAUI PackageId'
      ),
      mauiPackageVersion: requireRegexValue(
        resolve(
          REPO_ROOT,
          'libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj'
        ),
        /<PackageVersion>([^<]+)<\/PackageVersion>/,
        drifts,
        'MAUI PackageVersion'
      ),
      googleCompileSdk: requireRegexValue(
        resolve(REPO_ROOT, 'packages/google/openiap/build.gradle.kts'),
        /compileSdk\s*=\s*(\d+)/,
        drifts,
        'openiap-google compileSdk'
      ),
      googleMinSdk: requireRegexValue(
        resolve(REPO_ROOT, 'packages/google/openiap/build.gradle.kts'),
        /minSdk\s*=\s*(\d+)/,
        drifts,
        'openiap-google minSdk'
      ),
      googlePlayBillingVersion: requireRegexValue(
        resolve(REPO_ROOT, 'packages/google/openiap/build.gradle.kts'),
        /val\s+playBillingVersion\s*=\s*"([^"]+)"/,
        drifts,
        'openiap-google Play Billing version'
      ),
      kmpCompileSdk: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/kmp-iap/gradle/libs.versions.toml'),
        /^android-compileSdk = "([^"]+)"/m,
        drifts,
        'kmp-iap android-compileSdk'
      ),
      kmpMinSdk: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/kmp-iap/gradle/libs.versions.toml'),
        /^android-minSdk = "([^"]+)"/m,
        drifts,
        'kmp-iap android-minSdk'
      ),
      kmpTargetSdk: requireRegexValue(
        resolve(REPO_ROOT, 'libraries/kmp-iap/gradle/libs.versions.toml'),
        /^android-targetSdk = "([^"]+)"/m,
        drifts,
        'kmp-iap android-targetSdk'
      ),
    };

    for (const [key, expectedValue] of Object.entries(expected)) {
      if (expectedValue === null) continue;
      if (metadata[key] !== expectedValue) {
        drifts.push({
          file: DOC_VERSION_METADATA_FILE,
          line: metadataKeyLine(metadataSource, key),
          rule: 'R10',
          message: `${key} must match the package/library SSOT value "${expectedValue}". Run ./scripts/sync-versions.sh.`,
        });
      }
    }
  }

  if (!statSyncSafe(VERSIONING_FILE)) {
    drifts.push({
      file: VERSIONING_FILE,
      line: 1,
      rule: 'R10',
      message: 'versioning.ts is missing.',
    });
    return drifts;
  }

  const source = readFileSync(VERSIONING_FILE, 'utf8');
  if (!source.includes('../generated/version-metadata.json')) {
    drifts.push({
      file: VERSIONING_FILE,
      line: 1,
      rule: 'R10',
      message:
        'versioning.ts must read framework package versions from generated version-metadata.json.',
    });
  }
  for (const forbidden of ['../../../../libraries/', '../../../../packages/']) {
    const index = source.indexOf(forbidden);
    if (index !== -1) {
      drifts.push({
        file: VERSIONING_FILE,
        line: lineNumberAt(source, index),
        rule: 'R10',
        message:
          'versioning.ts must not raw-import files outside packages/docs; Vercel deploys the docs package root.',
      });
    }
  }

  return drifts;
}

const RESERVED_WORDS = new Set([
  'true',
  'false',
  'null',
  'void',
  'any',
  'never',
  'string',
  'number',
  'boolean',
  'object',
  'undefined',
  'this',
  'self',
  'super',
  'async',
  'await',
  'yield',
  'try',
  'catch',
  'finally',
  'throw',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'const',
  'let',
  'var',
  'function',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
  'abstract',
  'as',
  'is',
  'in',
  'of',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'import',
  'export',
  'from',
  'default',
  'package',
]);

/**
 * Verify a `/docs/<path>` link resolves to a real .tsx page (or its
 * containing folder's `index.tsx`).
 */
function linkResolves(target: string): boolean {
  const [pathPart] = target.split('#');
  // strip leading /docs and trailing slash
  const slug = pathPart.replace(/^\/docs\/?/, '').replace(/\/$/, '');
  if (!slug) return statSyncSafe(join(DOC_PAGES_DIR, 'docs/index.tsx'));
  const candidates = [
    join(DOC_PAGES_DIR, 'docs', `${slug}.tsx`),
    join(DOC_PAGES_DIR, 'docs', slug, 'index.tsx'),
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
  const typeIndex = buildTypeIndex();
  const drifts: Drift[] = [];

  // Build the set of every known field name across every type — used as
  // a lenient fallback for "is this field plausible?" checks. (We don't
  // know which type a `<code>foo</code>` mention belongs to without
  // page-level context, so we accept any field that exists somewhere in
  // types.ts.)
  const allFields = new Set<string>();
  for (const v of typeIndex.values()) {
    for (const f of v.fields) allFields.add(f);
  }

  // Common framework + JS / Dart / Kotlin words that appear in code
  // examples without being IAP fields. Excluded from the fallback.
  const SAFE_WORDS = new Set([
    'console',
    'log',
    'error',
    'warn',
    'instance',
    'shared',
    'connected',
    'await',
    'use',
    'effect',
    'callback',
    'fn',
    'cb',
    'i',
    'j',
    'k',
    'p',
    'a',
    'b',
    'c',
    'x',
    'y',
    'value',
    'name',
    'message',
    'code',
    'reason',
    'data',
    'json',
    'token',
    'url',
    'sku',
    'id',
    'type',
    'platform',
    'native',
    'success',
    'result',
    'error',
    'props',
    'options',
    'params',
    'config',
    'request',
    'args',
    'purchase',
    'product',
    'subscription',
    // Top-level scalar/list function parameters. These legitimately appear
    // in API parameter lists but are not generated object fields.
    'program',
    'subscriptionIds',
    'tokenType',
    'groupId',
    'noticeType',
    'continued',
    'reconnect',
    'cancel',
    'open',
    'close',
    'state',
    'status',
    'group',
    'ok',
    'os',
    'isIOS',
    'isAndroid',
    'productId',
    'orderId',
    'transactionId',
    'purchaseToken',
    'currency',
    'price',
    'count',
    'index',
    'size',
    'length',
    'env',
    'process',
    'self',
    'this',
    'super',
    'continuation',
    'deferred',
    'completion',
    'handler',
    'listener',
    'emitter',
    'subscriber',
    'unsubscribe',
    'remove',
    'add',
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
          rule: 'R5',
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
        rule: 'R3',
        message: `<code>${field}</code> is not a known field on any generated TypeScript type. Did you rename or invent it?`,
      });
    }
  }

  const activeDocPages = await walkTsxFiles(ACTIVE_DOCS_ROOT);
  for (const file of activeDocPages) {
    if (resolve(file) === RELEASE_NOTES_FILE) continue;
    drifts.push(
      ...auditActiveCodeExampleSource(file, readFileSync(file, 'utf8'))
    );
  }

  drifts.push(...auditReleaseNotePackageLinks(RELEASE_NOTES_FILE));
  drifts.push(...auditVersionMetadata());
  drifts.push(
    ...auditCanonicalOfferDocs({
      discountOffer: {
        file: DISCOUNT_OFFER_DOC_FILE,
        source: readFileSync(DISCOUNT_OFFER_DOC_FILE, 'utf8'),
      },
      subscriptionOffer: {
        file: SUBSCRIPTION_OFFER_DOC_FILE,
        source: readFileSync(SUBSCRIPTION_OFFER_DOC_FILE, 'utf8'),
      },
      searchData: {
        file: SEARCH_DATA_FILE,
        source: readFileSync(SEARCH_DATA_FILE, 'utf8'),
      },
    })
  );

  // R5 (broken /docs links) is a hard failure; R3 (field name not in
  // generated types) is a warning because top-level scalar function
  // params (e.g. `sku: string`, `program: BillingProgramAndroid`)
  // legitimately appear in `<ul className="api-params">` lists without
  // being a field of any type — the audit can't tell them apart from
  // genuine drift without knowing each function's signature.
  const hardFailures = drifts.filter((d) => d.rule !== 'R3');
  const warnings = drifts.filter((d) => d.rule === 'R3');

  if (hardFailures.length === 0 && warnings.length === 0) {
    console.log('audit-docs: clean — 0 drift detected');
    process.exit(0);
  }

  if (warnings.length > 0) {
    console.log(`audit-docs: ${warnings.length} warning(s)\n`);
    for (const d of warnings) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    console.log('');
  }

  if (hardFailures.length > 0) {
    console.log(`audit-docs: ${hardFailures.length} drift(s) detected\n`);
    for (const d of hardFailures) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    process.exit(1);
  }

  console.log('audit-docs: no hard failures (warnings above are advisory)');
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('audit-docs: fatal error');
    console.error(err);
    process.exit(2);
  });
}
