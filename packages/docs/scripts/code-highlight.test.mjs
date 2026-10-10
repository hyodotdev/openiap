import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HIGHLIGHT_LANGUAGES,
  escapeHtml,
  highlightCode,
  highlightXml,
} from '../src/lib/codeHighlight.ts';

const t = (type, text) => `<span class="token ${type}">${text}</span>`;

// Highlighting only wraps text, so removing the markup must give the source back.
const plain = (html) =>
  html.replace(
    /<span class="token [a-z-]+">|<a class="token [a-z -]+" href="[^"]*">|<\/span>|<\/a>/g,
    ''
  );

const TAG = /<(\/?)(span|a)(?: class="token [a-z -]+")?(?: href="[^"]*")?>/y;

// Why highlighted markup is wrong, or null when it is only balanced token
// spans and links around the unchanged source text.
function problem(source, html) {
  const open = [];
  let text = '';
  let run = '';
  for (let i = 0; i < html.length; ) {
    if (html[i] !== '<') {
      run += html[i++];
      continue;
    }
    // A tag inside an entity would make the browser show different text.
    if (/&(?!amp;|lt;|gt;)/.test(run)) return `split entity at ${i}`;
    text += run;
    run = '';
    TAG.lastIndex = i;
    const tag = TAG.exec(html);
    if (!tag) return `unknown markup at ${i}`;
    if (!tag[1]) open.push(tag[2]);
    else if (open.pop() !== tag[2]) return `unbalanced </${tag[2]}>`;
    i += tag[0].length;
  }
  if (/&(?!amp;|lt;|gt;)/.test(run)) return 'split entity at the end';
  text += run;
  if (open.length) return `unclosed <${open.at(-1)}>`;
  return text === escapeHtml(source) ? null : 'text changed';
}

test('keeps XML attributes intact', () => {
  const source = `<SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'ios'">15.0</SupportedOSPlatformVersion>`;
  const html = highlightXml(source);
  assert.ok(
    html.includes(
      `<span class="token attr-name">Condition</span>=<span class="token attr-value">"$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'ios'"</span>`
    )
  );
  assert.equal(plain(html), escapeHtml(source));
});

test('highlights namespaced attributes across lines', () => {
  const html = highlightXml(
    '<meta-data\n    android:name="a"\n    android:value="b" />'
  );
  assert.equal(
    html,
    '<span class="token punctuation">&lt;</span><span class="token tag">meta-data</span>\n' +
      '    <span class="token attr-name">android:name</span>=<span class="token attr-value">"a"</span>\n' +
      '    <span class="token attr-name">android:value</span>=<span class="token attr-value">"b"</span> <span class="token punctuation">/&gt;</span>'
  );
});

test('highlights attributes with spaces around =', () => {
  assert.ok(
    highlightXml('<a b = "c"/>').includes(
      '<span class="token attr-name">b</span> = <span class="token attr-value">"c"</span>'
    )
  );
});

test('keeps < and > inside a quoted value', () => {
  const html = highlightXml(`<a b="1 > 0 < 2" c='x "y"'>t</a>`);
  assert.ok(
    html.includes('<span class="token attr-value">"1 &gt; 0 &lt; 2"</span>')
  );
  assert.ok(html.includes(`<span class="token attr-value">'x "y"'</span>`));
});

test('marks comments and leaves broken markup as text', () => {
  assert.equal(
    highlightXml('<!--\n  a="b"\n-->'),
    '<span class="token comment">&lt;!--\n  a="b"\n--&gt;</span>'
  );
  assert.equal(highlightXml('<a b="c>text'), '&lt;a b="c&gt;text');
});

test('stops a broken tag at the next one', () => {
  assert.equal(
    highlightXml('<a\n<b c="d">'),
    '&lt;a\n<span class="token punctuation">&lt;</span><span class="token tag">b</span> <span class="token attr-name">c</span>=<span class="token attr-value">"d"</span><span class="token punctuation">&gt;</span>'
  );
});

test('never changes the text it highlights in XML', () => {
  const sample = `<?xml version="1.0"?>\n<!-- c -->\n<a b='1' c:d = "x > y"\n  e="2"/>\n<b>t &amp; u < v</b>`;
  for (let start = 0; start < sample.length; start++) {
    for (let end = start; end <= sample.length; end++) {
      const source = sample.slice(start, end);
      assert.equal(plain(highlightXml(source)), escapeHtml(source), source);
    }
  }
});

test('keeps the space before a call paren', () => {
  assert.equal(
    highlightCode('foo (x)', 'typescript'),
    `${t('function', 'foo')} (x)`
  );
  assert.equal(
    highlightCode('foo  (x)', 'kotlin'),
    `${t('function', 'foo')}  (x)`
  );
});

test('keeps a variable inside a bash command intact', () => {
  assert.equal(
    highlightCode('EXPO_TV=$X npx expo', 'bash'),
    `${t('function', `EXPO_TV=${t('variable', '$X')}`)} npx expo`
  );
});

test('keeps a braced variable inside a bash command intact', () => {
  assert.equal(
    highlightCode('EXPO_TV=${A} npx expo start', 'bash'),
    `${t('function', `EXPO_TV=${t('variable', '${A}')}`)} npx expo start`
  );
});

test('keeps a variable from straddling the end of a bash command', () => {
  assert.equal(
    highlightCode('EXPO_TV=${A b} npx', 'bash'),
    `${t('function', 'EXPO_TV=${A')} b} npx`
  );
});

test('keeps the tab before a bash flag', () => {
  assert.equal(
    highlightCode('ls\t-la', 'bash'),
    `ls\t${t('attr-name', '-la')}`
  );
});

test('keeps the spacing around : and = in YAML, TOML and properties', () => {
  assert.equal(
    highlightCode('name: x', 'yaml'),
    `${t('attr-name', 'name')}: x`
  );
  assert.equal(
    highlightCode('a = 1', 'toml'),
    `${t('attr-name', 'a')} = ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('a=b', 'properties'),
    `${t('attr-name', 'a')}=${t('string', 'b')}`
  );
  assert.equal(
    highlightCode('a = b', 'properties'),
    `${t('attr-name', 'a')} = ${t('string', 'b')}`
  );
  // Classic Mac line endings leave several records in one "line".
  assert.equal(
    highlightCode('a=1\rb=2', 'properties'),
    `${t('attr-name', 'a')}=${t('string', '1')}\r${t('attr-name', 'b')}=${t('string', '2')}`
  );
});

test('colors GraphQL field types and trailing comments', () => {
  assert.equal(
    highlightCode('  name: [String!]!   # note: kept', 'graphql'),
    `  ${t('field', 'name')}${t('punctuation', ':')} ${t('punctuation', '[')}${t('builtin-type', 'String')}${t('required', '!')}${t('punctuation', ']')}${t('required', '!')}   ${t('comment', '# note: kept')}`
  );
  assert.equal(
    highlightCode('  field(arg: Int = 1): Foo', 'graphql'),
    `  field(arg: ${t('builtin-type', 'Int')} = 1): ${t('custom-type', 'Foo')}`
  );
  assert.equal(
    highlightCode('  n: String = "#fff" # c', 'graphql'),
    `  ${t('field', 'n')}${t('punctuation', ':')} ${t('builtin-type', 'String')} = "#fff" ${t('comment', '# c')}`
  );
  assert.equal(
    highlightCode('type  Foo {', 'graphql'),
    `${t('keyword', 'type')}  ${t('type-name', 'Foo')} {`
  );
});

test('does not color a GraphQL alias or a string as a type', () => {
  for (const call of ['picture(size: 64)', 'picture (size: 64)']) {
    assert.equal(
      highlightCode(`  pic: ${call}`, 'graphql'),
      `  ${t('field', 'pic')}${t('punctuation', ':')} ${call}`
    );
  }
  assert.equal(
    highlightCode('  small: thumbnail { url }', 'graphql'),
    `  ${t('field', 'small')}${t('punctuation', ':')} thumbnail { url }`
  );
  assert.equal(
    highlightCode('"desc" amount: Int', 'graphql'),
    `"desc" ${t('field', 'amount')}${t('punctuation', ':')} ${t('builtin-type', 'Int')}`
  );
  assert.equal(
    highlightCode('  a: Int @deprecated(reason: "Use amount: x")', 'graphql'),
    `  ${t('field', 'a')}${t('punctuation', ':')} ${t('builtin-type', 'Int')} @deprecated(reason: "Use amount: x")`
  );
});

test('closes a string after an escaped backslash', () => {
  assert.equal(
    highlightCode('{"path": "C:\\\\", "next": 1}', 'json'),
    `{${t('attr-name', '"path"')}: ${t('string', '"C:\\\\"')}, ${t('attr-name', '"next"')}: ${t('number', '1')}}`
  );
  assert.equal(
    highlightCode('  join(sep: String = "\\\\"): String', 'graphql'),
    `  join(sep: ${t('builtin-type', 'String')} = "\\\\"): ${t('builtin-type', 'String')}`
  );
  assert.equal(
    highlightCode('a = "x\\"y"', 'swift'),
    `a = ${t('string', '"x\\"y"')}`
  );
});

test('links known type names and leaves unknown ones as plain class names', () => {
  const link =
    '<a class="token class-name type-ref" href="/docs/types/active-subscription">ActiveSubscription</a>';
  for (const [language, source] of [
    ['swift', 'let a: ActiveSubscription, b: Nope'],
    ['typescript', 'const a: ActiveSubscription, b: Nope'],
  ]) {
    const html = highlightCode(source, language);
    assert.ok(html.includes(link), language);
    assert.ok(html.includes(t('class-name', 'Nope')), language);
  }
});

// Pieces that have broken a highlighter before, mixed with plain syntax.
const PIECES = [
  ' ',
  '  ',
  '\t',
  '\n',
  '\r',
  '\r\n',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  ',',
  ':',
  ': ',
  ';',
  '=',
  ' = ',
  '.',
  '!',
  '#',
  '//',
  '@',
  '$',
  '-',
  '--',
  '|',
  '&',
  '<',
  '>',
  '"',
  "'",
  '`',
  '\\',
  '1',
  '2.5',
  'x',
  'foo',
  'Foo',
  'ActiveSubscription',
  'String',
  'true',
  'null',
  'if',
  'const',
  'func',
  'class',
  'import',
  'Future',
  '@available',
  '@Composable',
  'foo (x)',
  'a=b',
  'a = b',
  'key: v',
  'x:Int',
  '[ID!]!',
  '# note: v',
  'type',
  'enum',
  '"""',
  '[section]',
  'EXPO_TV=$X',
  '${a -b}',
  '$HOME',
  'npx',
  '--flag',
  '-f',
  '<a',
  '</',
  '/>',
  '<!--',
  '-->',
];

// mulberry32: a small seeded generator, so the same inputs run every time.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

test('never changes the text it highlights, in any language', () => {
  const next = random(2024);
  for (const language of HIGHLIGHT_LANGUAGES) {
    for (let i = 0; i < 1500; i++) {
      let source = '';
      for (let n = 1 + Math.floor(next() * 12); n > 0; n--) {
        source += PIECES[Math.floor(next() * PIECES.length)];
      }
      const issue = problem(source, highlightCode(source, language));
      assert.equal(issue, null, `${language} ${JSON.stringify(source)}`);
    }
  }
});
