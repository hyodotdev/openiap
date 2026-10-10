// Syntax highlighting for CodeBlock as pure string-to-HTML functions, so Node
// tests can run them.

import { TYPE_LINKS } from './typeLinks.ts';

export type CodeLanguage =
  | 'graphql'
  | 'typescript'
  | 'javascript'
  | 'swift'
  | 'kotlin'
  | 'dart'
  | 'xml'
  | 'gdscript'
  | 'csharp'
  | 'bash'
  | 'json'
  | 'yaml'
  | 'groovy'
  | 'toml'
  | 'text'
  | 'properties';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const token = (type: string, html: string): string =>
  `<span class="token ${type}">${html}</span>`;

interface Part {
  type: 'string' | 'code';
  value: string;
}

// Splits a line into quoted strings and the code between them. With
// `escapes`, a quote after a backslash does not close the string.
function splitStrings(line: string, quotes: string, escapes: boolean): Part[] {
  const parts: Part[] = [];
  let current = '';
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (!quote && quotes.includes(char)) {
      if (current) parts.push({ type: 'code', value: current });
      quote = char;
      current = char;
    } else if (quote && char === quote && !(escapes && line[i - 1] === '\\')) {
      parts.push({ type: 'string', value: current + char });
      current = '';
      quote = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push({ type: quote ? 'string' : 'code', value: current });
  return parts;
}

function mapLines(
  text: string,
  highlightLine: (line: string) => string
): string {
  return text.split('\n').map(highlightLine).join('\n');
}

// Wraps a class-name token in an anchor when it matches a known type.
// Caller is responsible for HTML-escaping the input.
function linkifyType(name: string): string {
  const href = TYPE_LINKS[name];
  if (href) {
    return `<a class="token class-name type-ref" href="${href}">${name}</a>`;
  }
  return `<span class="token class-name">${name}</span>`;
}

// Links capitalized identifiers only in text outside every tag, so words inside
// a span an earlier pass emitted (Dart `Future`, GDScript `String`, wrapped
// calls) keep their color. No lookbehind: Safari < 16.4 lacks it under Vite's
// default target.
function linkifyTypesInTextSegments(html: string): string {
  let depth = 0;
  return html
    .split(/(<[^>]+>)/)
    .map((segment) => {
      if (segment.startsWith('<')) {
        // Self-closing `<br/>` etc. don't change depth.
        if (segment.endsWith('/>')) return segment;
        if (segment.startsWith('</')) depth = Math.max(0, depth - 1);
        else depth += 1;
        return segment;
      }
      if (depth > 0) return segment;
      return segment.replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, (_, name: string) =>
        linkifyType(name)
      );
    })
    .join('');
}

const NUMBER = /\b(\d+\.?\d*)\b/g;
const FUNCTION_CALL = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

const wrapNumbers = (html: string): string =>
  html.replace(NUMBER, '<span class="token number">$1</span>');
const wrapCalls = (html: string): string =>
  html.replace(FUNCTION_CALL, '<span class="token function">$1</span>');

const TYPESCRIPT_KEYWORDS =
  /\b(import|export|from|as|default|const|let|var|function|async|await|class|extends|implements|interface|type|enum|if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|new|typeof|instanceof|void|null|undefined|true|false|this|super|static|public|private|protected|readonly|abstract|namespace|module|require|declare|constructor|get|set|of|in|yield|delete|debugger|with)\b/g;

function highlightTypescript(text: string): string {
  return mapLines(text, (line) => {
    if (line.trim().startsWith('//')) return token('comment', escapeHtml(line));
    return splitStrings(line, '"\'`', false)
      .map((part) => {
        if (part.type === 'string') {
          return token('string', escapeHtml(part.value));
        }
        const code = escapeHtml(part.value).replace(
          TYPESCRIPT_KEYWORDS,
          '<span class="token keyword">$1</span>'
        );
        return linkifyTypesInTextSegments(wrapCalls(wrapNumbers(code)));
      })
      .join('');
  });
}

const keywordPattern = (words: string): RegExp =>
  new RegExp(`\\b(${words})\\b`, 'g');

const NATIVE_KEYWORDS = {
  swift: keywordPattern(
    'import|func|let|var|if|else|for|while|do|switch|case|return|try|await|async|class|struct|enum|protocol|extension|guard|defer|in|is|as|self|super|static|final|override|public|private|internal|fileprivate|open|weak|unowned|lazy|mutating|nonmutating|convenience|required|subscript|deinit|init|typealias|associatedtype|where|throws|rethrows|catch|throw|nil|true|false|@available'
  ),
  kotlin: keywordPattern(
    'import|package|fun|val|var|if|else|for|while|do|when|return|try|catch|finally|throw|class|object|interface|enum|sealed|data|inner|open|abstract|override|public|private|internal|protected|suspend|inline|crossinline|noinline|reified|lateinit|by|companion|init|constructor|this|super|null|true|false|it|in|is|as|typealias|where'
  ),
  gdscript: keywordPattern(
    'func|var|const|class|class_name|extends|signal|enum|static|onready|export|preload|load|if|elif|else|for|while|match|break|continue|pass|return|await|yield|true|false|null|self|void|int|float|bool|String|Array|Dictionary|Vector2|Vector3|Object|Node|and|or|not|in|is|as'
  ),
  csharp: keywordPattern(
    'abstract|as|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|init|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|record|ref|required|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|var|virtual|void|volatile|while|yield|when|nameof|with'
  ),
  dart: keywordPattern(
    'import|export|library|part|show|hide|as|if|else|for|while|do|switch|case|default|break|continue|return|try|catch|finally|throw|rethrow|assert|class|abstract|extends|implements|with|mixin|enum|typedef|static|final|const|late|required|covariant|get|set|operator|factory|async|await|yield|sync|true|false|null|this|super|new|void|dynamic|var|Function|Future|Stream'
  ),
};

function highlightNative(
  text: string,
  language: keyof typeof NATIVE_KEYWORDS
): string {
  const keywords = NATIVE_KEYWORDS[language];
  return mapLines(text, (line) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
      return token('comment', escapeHtml(line));
    }
    return splitStrings(line, '"\'', true)
      .map((part) => {
        if (part.type === 'string') {
          return token('string', escapeHtml(part.value));
        }
        const code = escapeHtml(part.value).replace(
          keywords,
          '<span class="token keyword">$1</span>'
        );
        return linkifyTypesInTextSegments(wrapCalls(wrapNumbers(code))).replace(
          /@([a-zA-Z_][a-zA-Z0-9_]*)/g,
          '<span class="token decorator">@$1</span>'
        );
      })
      .join('');
  });
}

function highlightJson(text: string): string {
  return mapLines(text, (line) => {
    if (!line.trim()) return escapeHtml(line);
    const parts = splitStrings(line, '"', true);
    return parts
      .map((part, i) => {
        if (part.type === 'string') {
          const next = parts[i + 1];
          const isKey = next && next.value.trim().startsWith(':');
          return token(isKey ? 'attr-name' : 'string', escapeHtml(part.value));
        }
        return wrapNumbers(
          escapeHtml(part.value).replace(
            /\b(true|false|null)\b/g,
            '<span class="token keyword">$1</span>'
          )
        );
      })
      .join('');
  });
}

function highlightBash(text: string): string {
  return mapLines(text, (line) => {
    if (!line.trim()) return escapeHtml(line);
    if (line.trim().startsWith('#')) return token('comment', escapeHtml(line));
    let isFirstCode = true;
    return splitStrings(line, '"\'', true)
      .map((part) => {
        if (part.type === 'string') {
          return token('string', escapeHtml(part.value));
        }
        let code = escapeHtml(part.value).replace(
          /(\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*)/g,
          '<span class="token variable">$1</span>'
        );
        if (isFirstCode) {
          code = code.replace(
            /^(\s*)(npm|npx|yarn|bun|git|cd|mkdir|cp|rm|flutter|make|pod|eas|adb|curl|export|open|xcodebuild|EXPO_TV=\S+)\b/,
            '$1<span class="token function">$2</span>'
          );
        }
        isFirstCode = false;
        return code
          .replace(
            /\s(--?[a-zA-Z][\w-]*)/g,
            ' <span class="token attr-name">$1</span>'
          )
          .replace(
            /(\||&amp;&amp;|&gt;|&lt;)/g,
            '<span class="token keyword">$1</span>'
          );
      })
      .join('');
  });
}

function highlightYaml(text: string): string {
  return mapLines(text, (line) => {
    if (!line.trim()) return escapeHtml(line);
    if (line.trim().startsWith('#')) return token('comment', escapeHtml(line));
    if (/^\s*\[/.test(line)) {
      return escapeHtml(line).replace(
        /(\[[^\]]+\])/g,
        '<span class="token keyword">$1</span>'
      );
    }
    let isFirst = true;
    return splitStrings(line, '"\'', false)
      .map((part) => {
        if (part.type === 'string') {
          return token('string', escapeHtml(part.value));
        }
        let code = escapeHtml(part.value);
        if (isFirst) {
          code = code.replace(
            /^(\s*)([A-Za-z_][\w.-]*)\s*([:=])/,
            '$1<span class="token attr-name">$2</span> $3'
          );
        }
        isFirst = false;
        return wrapNumbers(
          code.replace(
            /\b(true|false)\b/g,
            '<span class="token keyword">$1</span>'
          )
        );
      })
      .join('');
  });
}

const GROOVY_KEYWORDS =
  /\b(android|compileSdkVersion|compileSdk|minSdkVersion|minSdk|targetSdkVersion|targetSdk|defaultConfig|dependencies|implementation|def|if|else|for|while|return|true|false|null|new|class|extends|implements|import|package|static|final|void|int|boolean|String|project)\b/g;

function highlightGroovy(text: string): string {
  return mapLines(text, (line) => {
    if (!line.trim()) return escapeHtml(line);
    if (line.trim().startsWith('//')) return token('comment', escapeHtml(line));
    return splitStrings(line, '"\'', true)
      .map((part) => {
        if (part.type === 'string') {
          return token('string', escapeHtml(part.value));
        }
        return wrapCalls(
          wrapNumbers(
            escapeHtml(part.value).replace(
              GROOVY_KEYWORDS,
              '<span class="token keyword">$1</span>'
            )
          )
        );
      })
      .join('');
  });
}

function highlightProperties(text: string): string {
  return mapLines(text, (line) => {
    if (!line.trim()) return escapeHtml(line);
    if (line.trim().startsWith('#')) return token('comment', escapeHtml(line));
    return escapeHtml(line).replace(
      /^(\s*)([^=]+?)\s*(=)\s*(.*)/gm,
      '$1<span class="token attr-name">$2</span> $3 <span class="token string">$4</span>'
    );
  });
}

const GRAPHQL_BUILT_IN_TYPES = [
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
  'JSON',
  'Void',
];

function highlightGraphql(text: string): string {
  let inBlockString = false;

  return mapLines(text, (line) => {
    const trimmed = line.trim();
    const escaped = escapeHtml(line);

    if (!trimmed) {
      return escaped;
    }

    // Block string delimiters and contents
    if (trimmed.startsWith('"""')) {
      const result = token('string', escaped);
      const isSingleLineBlock =
        trimmed.length > 3 && trimmed.endsWith('"""') && trimmed !== '"""';
      if (!isSingleLineBlock) {
        inBlockString = !inBlockString;
      }
      return result;
    }

    if (inBlockString) {
      return token('string', escaped);
    }

    // Line comments
    if (trimmed.startsWith('#')) {
      return token('comment', escaped);
    }

    // Type/Input/Enum declarations
    const typeMatch = line.match(/^(\s*)(type|input|enum)\s+(\w+)(.*)$/);
    if (typeMatch) {
      const [, leading, keyword, typeName, rest] = typeMatch;
      const escapedRest = rest ? escapeHtml(rest) : '';
      return `${escapeHtml(leading)}${token('keyword', escapeHtml(keyword))} ${token('type-name', escapeHtml(typeName))}${escapedRest}`;
    }

    // Enum values (all caps with underscores)
    if (/^\s*[A-Z_]+\s*$/.test(line)) {
      return escaped.replace(
        /([A-Z_]+)/g,
        '<span class="token enum-value">$1</span>'
      );
    }

    // Field definitions (fieldName: Type)
    if (line.includes(':')) {
      const fieldProcessed = escaped.replace(
        /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*)(:)/g,
        '$1<span class="token field">$2</span>$3<span class="token punctuation">$4</span>'
      );

      return fieldProcessed.replace(
        /:\s*(\[?)([A-Za-z_][A-Za-z0-9_]*)(\]?)(!?)/g,
        (
          _match,
          bracket1: string,
          type: string,
          bracket2: string,
          exclaim: string
        ) => {
          let result = ':<span class="token punctuation"> </span>';
          if (bracket1) result += '<span class="token punctuation">[</span>';

          if (GRAPHQL_BUILT_IN_TYPES.includes(type)) {
            result += `<span class="token builtin-type">${escapeHtml(type)}</span>`;
          } else {
            result += `<span class="token custom-type">${escapeHtml(type)}</span>`;
          }

          if (bracket2) result += '<span class="token punctuation">]</span>';
          if (exclaim) result += '<span class="token required">!</span>';
          return result;
        }
      );
    }

    return escaped;
  });
}

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

export function highlightCode(text: string, language: CodeLanguage): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return highlightTypescript(text);
    case 'swift':
    case 'kotlin':
    case 'dart':
    case 'gdscript':
    case 'csharp':
      return highlightNative(text, language);
    case 'xml':
      return highlightXml(text);
    case 'json':
      return highlightJson(text);
    case 'bash':
      return highlightBash(text);
    case 'yaml':
    case 'toml':
      return highlightYaml(text);
    case 'groovy':
      return highlightGroovy(text);
    case 'properties':
      return highlightProperties(text);
    case 'text':
      return escapeHtml(text);
    case 'graphql':
      return highlightGraphql(text);
  }
}
