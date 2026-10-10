// Syntax highlighting for CodeBlock as pure string-to-HTML functions, so Node
// tests can run them.

import { TYPE_LINKS } from './typeLinks.ts';

export const HIGHLIGHT_LANGUAGES = [
  'graphql',
  'typescript',
  'javascript',
  'swift',
  'kotlin',
  'dart',
  'xml',
  'gdscript',
  'csharp',
  'bash',
  'json',
  'yaml',
  'groovy',
  'toml',
  'text',
  'properties',
] as const;

export type HighlightLanguage = (typeof HIGHLIGHT_LANGUAGES)[number];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const token = (type: string, html: string): string =>
  `<span class="token ${type}">${html}</span>`;

// Wraps a class-name token in an anchor when it matches a known type.
function linkifyType(name: string): string {
  const href = TYPE_LINKS[name];
  if (href) {
    return `<a class="token class-name type-ref" href="${href}">${escapeHtml(name)}</a>`;
  }
  return token('class-name', escapeHtml(name));
}

// A rule matches at the current position. Its text becomes a token span, goes
// through `render`, or, with neither, stays plain so no later rule can match
// inside it. Patterns are sticky; `^` needs the `m` flag to mean line start.
interface Rule {
  pattern: RegExp;
  type?: string;
  render?: (match: RegExpExecArray) => string;
}

// One left-to-right scan: every character belongs to exactly one token or to
// the plain text between tokens, and each piece is escaped once.
function lex(text: string, rules: readonly Rule[]): string {
  let html = '';
  let plainFrom = 0;
  let i = 0;
  while (i < text.length) {
    let hit: { rule: Rule; match: RegExpExecArray } | undefined;
    for (const rule of rules) {
      rule.pattern.lastIndex = i;
      const match = rule.pattern.exec(text);
      if (match?.[0]) {
        hit = { rule, match };
        break;
      }
    }
    if (!hit) {
      i++;
      continue;
    }
    const { rule, match } = hit;
    html += escapeHtml(text.slice(plainFrom, i));
    if (rule.render) html += rule.render(match);
    else if (rule.type) html += token(rule.type, escapeHtml(match[0]));
    else html += escapeHtml(match[0]);
    i = plainFrom = i + match[0].length;
  }
  return html + escapeHtml(text.slice(plainFrom));
}

const lexer =
  (rules: readonly Rule[]) =>
  (text: string): string =>
    lex(text, rules);

// A comment that starts at a word boundary: `#` in bash and YAML.
const wordComment: Rule = {
  pattern: /(^|[ \t])(#[^\n]*)/my,
  render: (m) => escapeHtml(m[1]) + token('comment', escapeHtml(m[2])),
};
// The first group stays plain; the second group is the token.
const prefixed = (pattern: RegExp, type: string): Rule => ({
  pattern,
  render: (m) => escapeHtml(m[1]) + token(type, escapeHtml(m[2])),
});

const LINE_COMMENT: Rule = { pattern: /\/\/[^\n]*/y, type: 'comment' };
const BLOCK_COMMENT: Rule = {
  pattern: /\/\*[\s\S]*?(?:\*\/|$)/y,
  type: 'comment',
};
const HASH_COMMENT: Rule = { pattern: /#[^\n]*/y, type: 'comment' };

const DOUBLE_QUOTED: Rule = {
  pattern: /"(?:[^"\\\n]|\\.)*"?/y,
  type: 'string',
};
const SINGLE_QUOTED: Rule = {
  pattern: /'(?:[^'\\\n]|\\.)*'?/y,
  type: 'string',
};
const LITERAL_SINGLE_QUOTED: Rule = { pattern: /'[^'\n]*'?/y, type: 'string' };
const BACKTICK_QUOTED: Rule = {
  pattern: /`(?:[^`\\]|\\[\s\S])*`?/y,
  type: 'string',
};
const TRIPLE_QUOTED: Rule = {
  pattern: /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)/y,
  type: 'string',
};

const keyword = (words: string): Rule => ({
  pattern: new RegExp(`\\b(?:${words})\\b`, 'y'),
  type: 'keyword',
});
const NUMBER: Rule = { pattern: /\b\d+\.?\d*\b/y, type: 'number' };
const CALL: Rule = {
  pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=[ \t]*\()/y,
  type: 'function',
};
const TYPE: Rule = {
  pattern: /\b[A-Z][a-zA-Z0-9_]*\b/y,
  render: (m) => linkifyType(m[0]),
};
const DECORATOR: Rule = { pattern: /@[A-Za-z_]\w*/y, type: 'decorator' };
// C# `@params` is an identifier, not an annotation or a keyword.
const VERBATIM_IDENTIFIER: Rule = { pattern: /@[A-Za-z_]\w*/y };
const DIRECTIVE = prefixed(/^([ \t]*)(#[a-z]\w*)/my, 'keyword');

const slashComments = [LINE_COMMENT, BLOCK_COMMENT];

const TYPESCRIPT_RULES: Rule[] = [
  ...slashComments,
  BACKTICK_QUOTED,
  DOUBLE_QUOTED,
  SINGLE_QUOTED,
  keyword(
    'import|export|from|as|default|const|let|var|function|async|await|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|new|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|namespace|module|require|declare|constructor|get|set|of|in|yield|delete|debugger|with'
  ),
  NUMBER,
  CALL,
  TYPE,
];

const NATIVE_KEYWORDS = {
  swift:
    'import|func|let|var|if|else|for|while|do|switch|case|return|try|await|async|class|struct|enum|protocol|extension|guard|defer|in|is|as|self|super|static|final|override|public|private|internal|fileprivate|open|weak|unowned|lazy|mutating|nonmutating|convenience|required|subscript|deinit|init|typealias|associatedtype|where|throws|rethrows|catch|throw|nil|true|false',
  kotlin:
    'import|package|fun|val|var|if|else|for|while|do|when|return|try|catch|finally|throw|class|object|interface|enum|sealed|data|inner|open|abstract|override|public|private|internal|protected|suspend|inline|crossinline|noinline|reified|lateinit|by|companion|init|constructor|this|super|null|true|false|it|in|is|as|typealias|where',
  gdscript:
    'func|var|const|class|class_name|extends|signal|enum|static|onready|export|preload|load|if|elif|else|for|while|match|break|continue|pass|return|await|yield|true|false|null|self|void|int|float|bool|String|Array|Dictionary|Vector2|Vector3|Object|Node|and|or|not|in|is|as',
  csharp:
    'abstract|as|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|init|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|record|ref|required|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|var|virtual|void|volatile|while|yield|when|nameof|with',
  dart: 'import|export|library|part|show|hide|as|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|rethrow|assert|class|abstract|extends|implements|with|mixin|enum|typedef|static|final|const|late|required|covariant|get|set|operator|factory|async|await|yield|sync|true|false|null|this|super|new|void|dynamic|var|Function|Future|Stream',
};

const nativeRules = (language: keyof typeof NATIVE_KEYWORDS): Rule[] => [
  ...(language === 'gdscript' ? [HASH_COMMENT] : slashComments),
  ...(language === 'swift' || language === 'csharp' ? [DIRECTIVE] : []),
  TRIPLE_QUOTED,
  DOUBLE_QUOTED,
  SINGLE_QUOTED,
  language === 'csharp' ? VERBATIM_IDENTIFIER : DECORATOR,
  keyword(NATIVE_KEYWORDS[language]),
  NUMBER,
  CALL,
  TYPE,
];

const GROOVY_RULES: Rule[] = [
  ...slashComments,
  TRIPLE_QUOTED,
  DOUBLE_QUOTED,
  SINGLE_QUOTED,
  keyword(
    'android|compileSdkVersion|compileSdk|minSdkVersion|minSdk|targetSdkVersion|targetSdk|defaultConfig|dependencies|implementation|def|if|else|for|while|return|true|false|null|new|class|extends|implements|import|package|static|final|void|int|boolean|String|project'
  ),
  NUMBER,
  CALL,
];

const JSON_RULES: Rule[] = [
  { pattern: /"(?:[^"\\\n]|\\.)*"(?=[ \t]*:)/y, type: 'attr-name' },
  DOUBLE_QUOTED,
  keyword('true|false|null'),
  NUMBER,
];

const BASH_RULES: Rule[] = [
  wordComment,
  DOUBLE_QUOTED,
  LITERAL_SINGLE_QUOTED,
  prefixed(
    /^([ \t]*)((?:npm|npx|yarn|bun|git|cd|mkdir|cp|rm|flutter|make|pod|eas|adb|curl|export|open|xcodebuild)\b|EXPO_TV=\S+)/my,
    'function'
  ),
  {
    pattern: /\$\{[^}\n]+\}|\$[A-Za-z_][A-Za-z0-9_]*/y,
    type: 'variable',
  },
  prefixed(/([ \t])(--?[a-zA-Z][\w-]*)/y, 'attr-name'),
  { pattern: /\||&&|>|</y, type: 'keyword' },
];

const YAML_RULES: Rule[] = [
  wordComment,
  {
    pattern: /^[ \t]*\[[^\n]*/my,
    render: (m) =>
      escapeHtml(m[0]).replace(
        /(\[[^\]]+\])/g,
        '<span class="token keyword">$1</span>'
      ),
  },
  DOUBLE_QUOTED,
  LITERAL_SINGLE_QUOTED,
  {
    pattern: /^([ \t]*)([A-Za-z_][\w.-]*)([ \t]*[:=])/my,
    render: (m) =>
      escapeHtml(m[1]) +
      token('attr-name', escapeHtml(m[2])) +
      escapeHtml(m[3]),
  },
  keyword('true|false'),
  NUMBER,
];

const PROPERTIES_RULES: Rule[] = [
  prefixed(/^([ \t]*)([#!][^\n]*)/my, 'comment'),
  {
    pattern: /^([ \t]*)([^=\r\n]+?)([ \t]*=[ \t]*)([^\r\n]*)/my,
    render: (m) =>
      escapeHtml(m[1]) +
      token('attr-name', escapeHtml(m[2])) +
      escapeHtml(m[3]) +
      (m[4] ? token('string', escapeHtml(m[4])) : ''),
  },
];

const GRAPHQL_BUILT_IN_TYPES = [
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
  'JSON',
  'Void',
];

// A colon with the type that follows it: `: Int`, `: [Product!]!`. A name
// followed by `(` or `{` is an aliased field, not a type.
const GRAPHQL_COLON =
  /:(?:([ \t]*)(?![A-Za-z_]\w*[ \t]*[({])(\[*)([A-Za-z_]\w*)([!\]]*))?/y;

const GRAPHQL_RULES: Rule[] = [
  { pattern: /"""[\s\S]*?(?:"""|$)/y, type: 'string' },
  HASH_COMMENT,
  DOUBLE_QUOTED,
  {
    pattern:
      /^([ \t]*)((?:extend[ \t]+)?(?:type|input|enum|interface|union|scalar|directive|schema|query|mutation|subscription|fragment))(?=[ \t{]|$)(?:([ \t]+)(\w+))?/my,
    render: (m) =>
      escapeHtml(m[1]) +
      token('keyword', escapeHtml(m[2])) +
      (m[4] ? escapeHtml(m[3]) + token('type-name', escapeHtml(m[4])) : ''),
  },
  prefixed(
    /^([ \t]*)([A-Z_][A-Z_0-9]*)(?=[ \t]*(?:#[^\n]*)?$)/my,
    'enum-value'
  ),
  // `$name` stays plain so a variable is not taken for a field.
  { pattern: /\$[A-Za-z_]\w*/y },
  { pattern: /\b[A-Za-z_]\w*(?=[ \t]*:)/y, type: 'field' },
  {
    pattern: GRAPHQL_COLON,
    render: (m) =>
      token('punctuation', ':') +
      escapeHtml(m[1] ?? '') +
      (m[2] ?? '').replace(/\[/g, token('punctuation', '[')) +
      (m[3]
        ? token(
            GRAPHQL_BUILT_IN_TYPES.includes(m[3])
              ? 'builtin-type'
              : 'custom-type',
            escapeHtml(m[3])
          )
        : '') +
      (m[4] ?? '').replace(/[!\]]/g, (mark) =>
        mark === '!' ? token('required', '!') : token('punctuation', ']')
      ),
  },
];

// Both patterns read escaped text. A quoted value is consumed whole, so a `>`
// inside it cannot end the tag; an unquoted `<` ends the search, so an unclosed
// tag stops at the next one.
const XML_MARKUP =
  /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|(?!&lt;)[^"'])*?)(\/?&gt;)/g;
const XML_ATTRIBUTE = /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')/g;

// One replace per level: a pattern never sees markup an earlier one emitted.
export function highlightXml(source: string): string {
  return escapeHtml(source).replace(
    XML_MARKUP,
    (
      _match,
      comment: string | undefined,
      open: string,
      name: string,
      attributes: string,
      close: string
    ) =>
      comment === undefined
        ? token('punctuation', open) +
          token('tag', name) +
          attributes.replace(
            XML_ATTRIBUTE,
            (_attribute, key: string, equals: string, value: string) =>
              token('attr-name', key) + equals + token('attr-value', value)
          ) +
          token('punctuation', close)
        : token('comment', comment)
  );
}

const HIGHLIGHTERS: Record<HighlightLanguage, (text: string) => string> = {
  graphql: lexer(GRAPHQL_RULES),
  typescript: lexer(TYPESCRIPT_RULES),
  javascript: lexer(TYPESCRIPT_RULES),
  swift: lexer(nativeRules('swift')),
  kotlin: lexer(nativeRules('kotlin')),
  dart: lexer(nativeRules('dart')),
  xml: highlightXml,
  gdscript: lexer(nativeRules('gdscript')),
  csharp: lexer(nativeRules('csharp')),
  bash: lexer(BASH_RULES),
  json: lexer(JSON_RULES),
  yaml: lexer(YAML_RULES),
  groovy: lexer(GROOVY_RULES),
  toml: lexer(YAML_RULES),
  text: escapeHtml,
  properties: lexer(PROPERTIES_RULES),
};

export function highlightCode(
  text: string,
  language: HighlightLanguage
): string {
  return (HIGHLIGHTERS[language] ?? escapeHtml)(text);
}
