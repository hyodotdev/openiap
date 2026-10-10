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

// A rule matches at the current position. Its text becomes a token span, goes
// through `render`, or, with neither, stays plain so no later rule can match
// inside it. Patterns are sticky; `^` needs the `m` flag to mean line start.
interface Rule {
  pattern: RegExp;
  type?: string;
  render?: (match: RegExpExecArray) => string;
  // Applies only right after a character that matches, like the `$` of `$"`.
  after?: RegExp;
  // Skips the rule right after a character that matches, like the `s` in
  // `this@Label`. It also keeps a run of openers from rescanning itself.
  notAfter?: RegExp;
  // Where the token ends when a regex cannot tell, such as a comment that
  // nests. The pattern matches only the opener.
  end?: (text: string, start: number, afterOpener: number) => number;
}

const IDENTIFIER_CHAR = /[\w$]/;

// One left-to-right scan: every character belongs to exactly one token or to
// the plain text between tokens, and each piece is escaped once.
function lex(text: string, rules: readonly Rule[]): string {
  let html = '';
  let plainFrom = 0;
  let i = 0;
  while (i < text.length) {
    let hit: { rule: Rule; match: RegExpExecArray } | undefined;
    const previous = i > 0 ? text[i - 1] : '';
    for (const rule of rules) {
      if (rule.after && !rule.after.test(previous)) continue;
      if (rule.notAfter?.test(previous)) continue;
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
    const matchEnd = i + match[0].length;
    const end = rule.end ? rule.end(text, i, matchEnd) : matchEnd;
    const matched = text.slice(i, end);
    html += escapeHtml(text.slice(plainFrom, i));
    if (rule.render) html += rule.render(match);
    else if (rule.type) html += token(rule.type, escapeHtml(matched));
    else html += escapeHtml(matched);
    i = plainFrom = end;
  }
  return html + escapeHtml(text.slice(plainFrom));
}

// Counts the highlight calls, so what a rule remembers about a text is not
// carried into the next call that gets the same text.
let call = 0;

function lexer(rules: readonly Rule[]): (text: string) => string {
  return (text) => {
    call++;
    return lex(text, rules);
  };
}

// Runs `compute` once per highlight call and text, however many openers ask.
function perCall<T>(compute: (text: string) => T): (text: string) => T {
  let seenText: string | undefined;
  let seenCall = -1;
  let value: T;
  return (text) => {
    if (text !== seenText || seenCall !== call) {
      seenText = text;
      seenCall = call;
      value = compute(text);
    }
    return value;
  };
}

const lineEnd = (text: string, from: number): number => {
  const newline = text.indexOf('\n', from);
  return newline < 0 ? text.length : newline;
};

// A token that may span lines ends after the next `close`. With none left in
// the text it ends at its line, so a stray opener cannot swallow the rest of
// the block, and a run of them costs one search, not one each.
function endsAt(close: string): NonNullable<Rule['end']> {
  const lastClose = perCall((text) => text.lastIndexOf(close));
  return (text, _start, afterOpener) =>
    afterOpener > lastClose(text)
      ? lineEnd(text, afterOpener)
      : text.indexOf(close, afterOpener) + close.length;
}

// A hole is code inside a string, `${…}` or `\(…)`. Its brackets nest, and it
// can hold strings of its own, so a quote inside it does not end the string.
interface Hole {
  // What starts the hole inside a string.
  open: string;
  // The bracket that nests inside the hole, and the one that ends a level.
  nest: string;
  close: string;
  // A doubled opener is plain text (C# `{{`).
  doubled?: boolean;
}
interface Interpolation {
  holes: Hole[];
  // Quote characters that start a string inside a hole.
  quotes: string;
  // Which of those strings have holes too.
  interpolating: string;
  // Quotes whose strings take no backslash escapes (bash `'…'`).
  literal?: string;
}

const DOLLAR_BRACE: Interpolation = {
  holes: [{ open: '${', nest: '{', close: '}' }],
  quotes: `"'`,
  interpolating: '"',
};
const DART_BRACE: Interpolation = { ...DOLLAR_BRACE, interpolating: `"'` };
const SWIFT_PAREN: Interpolation = {
  holes: [{ open: '\\(', nest: '(', close: ')' }],
  quotes: '"',
  interpolating: '"',
};
// A plain string inside a hole has no holes: `{f("{")}`.
const CSHARP_BRACE: Interpolation = {
  holes: [{ open: '{', nest: '{', close: '}', doubled: true }],
  quotes: `"'`,
  interpolating: '',
};
const BASH_SUBSTITUTION: Interpolation = {
  holes: [
    { open: '$(', nest: '(', close: ')' },
    { open: '${', nest: '{', close: '}' },
  ],
  quotes: `"'`,
  interpolating: '"',
  literal: "'",
};
const TEMPLATE_BRACE: Interpolation = {
  holes: [{ open: '${', nest: '{', close: '}' }],
  quotes: `"'\``,
  interpolating: '`',
};

type Frame =
  | { quote: string; escapes: boolean; doubled: boolean; sawClose?: boolean }
  | { hole: Hole; depth: number };

// A string that closes on its line is scanned with its holes. If the scan
// fails, the string is read flat: up to the next closer `body` finds, or to the
// end of its line, and the rest of that line is read the same way. With
// `monotonic`, a search that finds no closer ends the search for every later
// opener too, because escapes pair up. Both keep a run of openers from
// rescanning the text.
function spanning(
  body: RegExp,
  quote: string,
  { holes, quotes, interpolating, literal = '' }: Interpolation,
  { verbatim = false, monotonic = false } = {}
): NonNullable<Rule['end']> {
  const memo = perCall(() => ({ failedLine: -1, noCloser: false }));
  // Just past the quote that closes the string whose body starts at `from`, or
  // -1 when its line ends first. A verbatim string has no backslash escapes and
  // writes a quote as `""`.
  function scan(text: string, from: number): number {
    const frames: Frame[] = [{ quote, escapes: !verbatim, doubled: verbatim }];
    for (let i = from; i < text.length; i++) {
      const char = text[i];
      if (char === '\n') return -1;
      const frame = frames[frames.length - 1];
      if ('quote' in frame) {
        // A string in a hole that has seen the hole's end and now meets the
        // outer quote was probably no string: a regex or a comment held a quote.
        const below = frames[frames.length - 2];
        if (below && 'hole' in below && !literal.includes(frame.quote)) {
          if (char === below.hole.close) frame.sawClose = true;
          else if (frame.sawClose && char === quote && char !== frame.quote) {
            return -1;
          }
        }
        const hole =
          frames.length === 1 || interpolating.includes(frame.quote)
            ? holes.find((h) => text.startsWith(h.open, i))
            : undefined;
        if (hole?.doubled && text.startsWith(hole.open + hole.open, i)) {
          i += hole.open.length;
        } else if (hole) {
          frames.push({ hole, depth: 1 });
          i += hole.open.length - 1;
        } else if (char === '\\' && frame.escapes && text[i + 1] !== '\n') {
          i++;
        } else if (char === frame.quote) {
          if (frame.doubled && text[i + 1] === char) {
            i++;
          } else {
            frames.pop();
            if (!frames.length) return i + 1;
          }
        }
      } else if (char === '\\' && text[i + 1] !== '\n') {
        i++;
      } else if (quotes.includes(char)) {
        frames.push({
          quote: char,
          escapes: !literal.includes(char),
          doubled: false,
        });
      } else if (char === frame.hole.nest) {
        frame.depth++;
      } else if (char === frame.hole.close && --frame.depth === 0) {
        frames.pop();
      }
    }
    return -1;
  }
  return (text, _start, afterOpener) => {
    const seen = memo(text);
    if (afterOpener > seen.failedLine) {
      const end = scan(text, afterOpener);
      if (end >= 0) return end;
      seen.failedLine = lineEnd(text, afterOpener);
    }
    if (monotonic && seen.noCloser) return lineEnd(text, afterOpener);
    body.lastIndex = afterOpener;
    const flat = body.exec(text);
    if (!flat) {
      seen.noCloser = true;
      return lineEnd(text, afterOpener);
    }
    return afterOpener + flat[0].length;
  };
}

// A string on one line whose holes can hold quotes.
const interpolated = (
  quote: '"' | "'",
  interpolation: Interpolation
): Rule => ({
  pattern: quote === '"' ? /"/y : /'/y,
  type: 'string',
  end: spanning(
    quote === '"' ? /(?:[^"\\\n]|\\.)*"/y : /(?:[^'\\\n]|\\.)*'/y,
    quote,
    interpolation
  ),
});
const DOLLAR_DOUBLE_QUOTED = interpolated('"', DOLLAR_BRACE);
const DART_DOUBLE_QUOTED = interpolated('"', DART_BRACE);
const DART_SINGLE_QUOTED = interpolated("'", DART_BRACE);

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
  pattern: /\/\*/y,
  type: 'comment',
  end: endsAt('*/'),
};
// Found in one right-to-left pass over a text, so every `/*`, however the
// delimiters overlap, costs the same: `delimiter[j]` is the first index from j
// on where a `/*` or `*/` starts, and `exit[j]` is where the comment ends that a
// walk reaches when its next delimiter is the one at j (-1 if it never closes).
const nestedComments = perCall((text) => {
  const length = text.length;
  const delimiter = new Int32Array(length + 1).fill(length);
  const exit = new Int32Array(length + 1).fill(-1);
  for (let j = length - 1; j >= 0; j--) {
    const opens = text.startsWith('/*', j);
    const closes = text.startsWith('*/', j);
    delimiter[j] = opens || closes ? j : delimiter[j + 1];
    if (closes) exit[j] = j + 2;
    else if (opens) {
      // The walk steps over the comment this one opens, then goes on.
      const end = exit[delimiter[j + 2]];
      exit[j] = end < 0 ? -1 : exit[delimiter[end]];
    }
  }
  return { delimiter, exit };
});
// Kotlin, Swift and Dart comments nest: `/* a /* b */ c */` is one comment.
const NESTED_BLOCK_COMMENT: Rule = {
  pattern: /\/\*/y,
  type: 'comment',
  end: (text, start, afterOpener) => {
    const { delimiter, exit } = nestedComments(text);
    const end = exit[delimiter[start + 2]];
    return end < 0 ? lineEnd(text, afterOpener) : end;
  },
};
const HASH_COMMENT: Rule = { pattern: /#[^\n]*/y, type: 'comment' };

// A backslash escapes the next character, so an escaped quote or slash never
// opens a token. A backtick stays free: it may start a template.
const ESCAPED: Rule = { pattern: /\\(?!`)./y };

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
  pattern: /`/y,
  type: 'string',
  end: spanning(/(?:[^`\\]|\\[\s\S])*`/y, '`', TEMPLATE_BRACE, {
    monotonic: true,
  }),
};
// GDScript strings can hold line breaks.
const GDSCRIPT_DOUBLE_QUOTED: Rule = {
  pattern: /"(?:[^"\\]|\\[\s\S])*"|"[^\n]*/y,
  type: 'string',
};
const GDSCRIPT_SINGLE_QUOTED: Rule = {
  pattern: /'(?:[^'\\]|\\[\s\S])*'|'[^\n]*/y,
  type: 'string',
};
const TRIPLE_QUOTED: Rule = {
  pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|"""[^\n]*|'''[^\n]*/y,
  type: 'string',
};
// Kotlin closes a raw string at the last quote of a run: `"""a""""`. An
// unclosed one is left to TRIPLE_QUOTED.
const KOTLIN_RAW_STRING: Rule = {
  pattern: /"""[\s\S]*?"""(?!")/y,
  type: 'string',
};
// These forms take no backslash escapes, so `@"C:\dir\"` and `r'C:\'` end at
// their closing quote.
const VERBATIM_STRING: Rule = {
  pattern: /@"(?:[^"]|"")*"(?!")|@"[^\n]*/y,
  type: 'string',
};
const VERBATIM_BODY = /(?:[^"]|"")*"(?!")/y;
const INTERPOLATED_VERBATIM_STRING: Rule = {
  pattern: /@\$"/y,
  type: 'string',
  end: spanning(VERBATIM_BODY, '"', CSHARP_BRACE, { verbatim: true }),
};
// `$@"`: the `$` stays plain, as before a `$"`.
const DOLLAR_VERBATIM_STRING: Rule = {
  ...INTERPOLATED_VERBATIM_STRING,
  pattern: /@"/y,
  after: /\$/,
};
const DART_RAW_STRING: Rule = {
  pattern:
    /\br(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'''[^\n]*|"""[^\n]*|'[^'\n]*'?|"[^"\n]*"?)/y,
  type: 'string',
};
// `#"…"#` closes at a quote followed by the same number of hashes. A `#"""`
// opener is left to TRIPLE_QUOTED; the guard also keeps a run of them linear.
const SWIFT_RAW_STRING: Rule = {
  pattern: /(#+)"(?!"")[^\n]*?"\1|#+"(?!"")[^\n]*/y,
  type: 'string',
  notAfter: /#/,
};

const keyword = (words: string): Rule => ({
  pattern: new RegExp(`\\b(?:${words})\\b`, 'y'),
  type: 'keyword',
});
// Digits with `_` only between them: `1_000`, not `1_`. After a prefix a `_` may
// come first: C# `0x_FF`.
const grouped = (digit: string): string => `${digit}+(?:_+${digit}+)*`;
const DIGITS = grouped('\\d');
// Decimal with a fraction or exponent, hex, binary or octal. `16.dp` is the
// number 16 then `.dp`.
const NUMBER_BODY = `(?:0[xX]_*${grouped('[\\da-fA-F]')}|0[bB]_*${grouped('[01]')}|0[oO]_*${grouped('[0-7]')}|${DIGITS}(?:\\.${DIGITS})?(?:[eE][+-]?\\d+)?)`;
// The lookahead plus backreference commits to the longest body, so `1.5M` in a
// value cannot fall back to the number `1`.
const number = (suffix: string): Rule => ({
  pattern: new RegExp(String.raw`\b(?=(${NUMBER_BODY}))\1${suffix}\b`, 'y'),
  type: 'number',
});
// Code adds the f/d/l/u/m suffixes of the C-like languages; a value in JSON,
// YAML or TOML does not (`10m` there is not a number).
const NUMBER = number('[fFdDlLuUmM]*');
const DATA_NUMBER = number('');
const CALL: Rule = {
  pattern: /[a-zA-Z_$][a-zA-Z0-9_$]*(?=[ \t]*\()/y,
  type: 'function',
  notAfter: IDENTIFIER_CHAR,
};
// A capitalized word links to its type page when it names one.
const TYPE: Rule = {
  pattern: /\b[A-Z]\w*/y,
  render: ([name]) => {
    const href = TYPE_LINKS[name];
    return href
      ? `<a class="token class-name type-ref" href="${href}">${escapeHtml(name)}</a>`
      : token('class-name', escapeHtml(name));
  },
};
const DECORATOR: Rule = {
  pattern: /@[A-Za-z_]\w*/y,
  type: 'decorator',
  notAfter: IDENTIFIER_CHAR,
};
// C# `@params` is an identifier, not an annotation or a keyword.
const VERBATIM_IDENTIFIER: Rule = { pattern: /@[A-Za-z_]\w*/y };
const DIRECTIVE = prefixed(/^([ \t]*)(#[a-z]\w*)/my, 'keyword');

const slashComments = [LINE_COMMENT, BLOCK_COMMENT];
const nestingComments = [LINE_COMMENT, NESTED_BLOCK_COMMENT];

const TYPESCRIPT_RULES: Rule[] = [
  ESCAPED,
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

// What each language adds before the shared rules: its comments, and the
// directives and string forms only it has.
const NATIVE_EXTRAS = {
  swift: [...nestingComments, DIRECTIVE, SWIFT_RAW_STRING],
  kotlin: [...nestingComments, KOTLIN_RAW_STRING],
  gdscript: [ESCAPED, HASH_COMMENT],
  csharp: [
    ...slashComments,
    DIRECTIVE,
    INTERPOLATED_VERBATIM_STRING,
    DOLLAR_VERBATIM_STRING,
    VERBATIM_STRING,
  ],
  dart: [...nestingComments, DART_RAW_STRING],
} satisfies Record<keyof typeof NATIVE_KEYWORDS, Rule[]>;

// The quoted strings of each language. Only a C# string after `$` has holes.
const NATIVE_QUOTES = {
  swift: [interpolated('"', SWIFT_PAREN)],
  kotlin: [DOLLAR_DOUBLE_QUOTED, SINGLE_QUOTED],
  gdscript: [GDSCRIPT_DOUBLE_QUOTED, GDSCRIPT_SINGLE_QUOTED],
  csharp: [
    { ...interpolated('"', CSHARP_BRACE), after: /\$/ },
    DOUBLE_QUOTED,
    SINGLE_QUOTED,
  ],
  dart: [DART_DOUBLE_QUOTED, DART_SINGLE_QUOTED],
} satisfies Record<keyof typeof NATIVE_KEYWORDS, Rule[]>;

const nativeRules = (language: keyof typeof NATIVE_KEYWORDS): Rule[] => [
  ...NATIVE_EXTRAS[language],
  TRIPLE_QUOTED,
  ...NATIVE_QUOTES[language],
  language === 'csharp' ? VERBATIM_IDENTIFIER : DECORATOR,
  keyword(NATIVE_KEYWORDS[language]),
  NUMBER,
  CALL,
  TYPE,
];

const GROOVY_RULES: Rule[] = [
  ...slashComments,
  TRIPLE_QUOTED,
  DOLLAR_DOUBLE_QUOTED,
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
  DATA_NUMBER,
];

const BASH_RULES: Rule[] = [
  ESCAPED,
  wordComment,
  interpolated('"', BASH_SUBSTITUTION),
  LITERAL_SINGLE_QUOTED,
  prefixed(
    /^([ \t]*)((?:npm|npx|yarn|bun|git|cd|mkdir|cp|rm|flutter|make|pod|eas|adb|curl|export|open|xcodebuild)\b|EXPO_TV=[^\s"']+)/my,
    'function'
  ),
  {
    pattern: /\$\{[^}\n]+\}?|\$[A-Za-z_][A-Za-z0-9_]*/y,
    type: 'variable',
  },
  prefixed(/([ \t])(--?[a-zA-Z][\w-]*)/y, 'attr-name'),
  { pattern: /\||&&|>|</y, type: 'keyword' },
];

// A name at the start of a line, then its separator: `:` in YAML, `=` in TOML.
// A name may be all digits (`200:`, TOML `1234 =`).
const key = (separator: string): Rule => ({
  pattern: new RegExp(
    String.raw`^([ \t]*)(\w[\w.-]*)([ \t]*${separator})`,
    'my'
  ),
  render: (m) =>
    escapeHtml(m[1]) + token('attr-name', escapeHtml(m[2])) + escapeHtml(m[3]),
});

// YAML starts a comment only after whitespace, and an apostrophe after a word
// (`don't`, `1990's`) opens no string unless a quote closes it in the same word.
const YAML_RULES: Rule[] = [
  wordComment,
  DOUBLE_QUOTED,
  { pattern: /'(?=\w)(?![^'\s]*')/y, after: /\w/ },
  LITERAL_SINGLE_QUOTED,
  key(':'),
  keyword('true|false'),
  DATA_NUMBER,
];

// A TOML multi-line string closes at the last quote of a run, `"""a""""`. A
// basic one takes backslash escapes, so `\"` is no quote.
const TOML_BASIC_MULTILINE: Rule = {
  pattern: /"""(?:\\[\s\S]|[^\\])*?"""(?!")|"""[^\n]*/y,
  type: 'string',
};
const TOML_LITERAL_MULTILINE: Rule = {
  pattern: /'''[\s\S]*?'''(?!')|'''[^\n]*/y,
  type: 'string',
};

// TOML starts a comment at any `#` outside a string.
const TOML_RULES: Rule[] = [
  ESCAPED,
  HASH_COMMENT,
  // `^` with the `m` flag also starts after \r, U+2028 and U+2029, so this class
  // stops at all four, or a header with no `]` rescans from every line start.
  prefixed(/^([ \t]*)(\[[^\]\r\n\u2028\u2029]*\]+)/my, 'keyword'),
  TOML_BASIC_MULTILINE,
  TOML_LITERAL_MULTILINE,
  DOUBLE_QUOTED,
  LITERAL_SINGLE_QUOTED,
  key('='),
  keyword('true|false'),
  DATA_NUMBER,
];

// A key never holds a line end that starts a `^` match (see the TOML header).
const PROPERTIES_RULES: Rule[] = [
  prefixed(/^([ \t]*)([#!][^\n]*)/my, 'comment'),
  {
    pattern:
      /^([ \t]*)([^ \t\r\n\u2028\u2029=](?:[^=\r\n\u2028\u2029]*[^ \t\r\n\u2028\u2029=])?)([ \t]*=[ \t]*)([^\r\n]*)/my,
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
  // An escaped triple quote outside a string is not an opener.
  { pattern: /\\"""/y },
  {
    pattern: /"""(?:\\"""|\\(?!""")|[^\\])*?"""|"""[^\n]*/y,
    type: 'string',
  },
  HASH_COMMENT,
  DOUBLE_QUOTED,
  {
    // Column 0 only: an indented `subscription { … }` is a field in a selection.
    pattern:
      /^((?:extend[ \t]+)?(?:type|input|enum|interface|union|scalar|directive|schema|query|mutation|subscription|fragment))(?=[ \t{(]|$)(?:([ \t]+)(\w+))?/my,
    render: (m) =>
      token('keyword', escapeHtml(m[1])) +
      (m[3] ? escapeHtml(m[2]) + token('type-name', escapeHtml(m[3])) : ''),
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

const XML_ATTRIBUTES: Rule[] = [
  {
    pattern: /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')/y,
    notAfter: /[\w:.-]/,
    render: (m) =>
      token('attr-name', escapeHtml(m[1])) +
      escapeHtml(m[2]) +
      token('attr-value', escapeHtml(m[3])),
  },
];

const XML_RULES: Rule[] = [
  { pattern: /<!--/y, type: 'comment', end: endsAt('-->') },
  // A quoted value is consumed whole, so a `>` inside it cannot end the tag; an
  // unquoted `<` ends the search, so an unclosed tag stops at the next one.
  {
    pattern:
      /(<\/?)([A-Za-z_][\w:.-]*)(?![\w:.-])((?:"[^"]*"|'[^']*'|[^"'<])*?)(\/?>)/y,
    render: (m) =>
      token('punctuation', escapeHtml(m[1])) +
      token('tag', escapeHtml(m[2])) +
      lex(m[3], XML_ATTRIBUTES) +
      token('punctuation', escapeHtml(m[4])),
  },
];

const HIGHLIGHTERS: Record<HighlightLanguage, (text: string) => string> = {
  graphql: lexer(GRAPHQL_RULES),
  typescript: lexer(TYPESCRIPT_RULES),
  javascript: lexer(TYPESCRIPT_RULES),
  swift: lexer(nativeRules('swift')),
  kotlin: lexer(nativeRules('kotlin')),
  dart: lexer(nativeRules('dart')),
  xml: lexer(XML_RULES),
  gdscript: lexer(nativeRules('gdscript')),
  csharp: lexer(nativeRules('csharp')),
  bash: lexer(BASH_RULES),
  json: lexer(JSON_RULES),
  yaml: lexer(YAML_RULES),
  groovy: lexer(GROOVY_RULES),
  toml: lexer(TOML_RULES),
  text: escapeHtml,
  properties: lexer(PROPERTIES_RULES),
};

export function highlightCode(
  text: string,
  language: HighlightLanguage
): string {
  return HIGHLIGHT_LANGUAGES.includes(language)
    ? HIGHLIGHTERS[language](text)
    : escapeHtml(text);
}
