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

// Why highlighted markup is wrong, or null when it is only flat token spans
// and links around the unchanged source text.
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
    if (!tag[1]) {
      if (open.length) return `<${tag[2]}> inside <${open[0]}>`;
      open.push(tag[2]);
    } else if (open.pop() !== tag[2]) return `unbalanced </${tag[2]}>`;
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

test('does not call a name across a line break', () => {
  assert.equal(
    highlightCode('KmpIAP\n(x)', 'kotlin'),
    `${t('class-name', 'KmpIAP')}\n(x)`
  );
});

test('colors keywords, numbers, calls and types in order', () => {
  assert.equal(
    highlightCode('if (x > 10) return new Foo(1.5);', 'typescript'),
    `${t('keyword', 'if')} (x &gt; ${t('number', '10')}) ${t('keyword', 'return')} ${t('keyword', 'new')} ${t('function', 'Foo')}(${t('number', '1.5')});`
  );
  assert.equal(
    highlightCode('val a: Bar = Foo(2)', 'kotlin'),
    `${t('keyword', 'val')} a: ${t('class-name', 'Bar')} = ${t('function', 'Foo')}(${t('number', '2')})`
  );
  assert.equal(
    highlightCode('x = def(y) + 3', 'groovy'),
    `x = ${t('keyword', 'def')}(y) + ${t('number', '3')}`
  );
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

test('colors a bash assignment command as one token', () => {
  assert.equal(
    highlightCode('EXPO_TV=$X npx expo', 'bash'),
    `${t('function', 'EXPO_TV=$X')} npx expo`
  );
  assert.equal(
    highlightCode('EXPO_TV=${A} npx expo start', 'bash'),
    `${t('function', 'EXPO_TV=${A}')} npx expo start`
  );
  assert.equal(
    highlightCode('EXPO_TV=${A b} npx', 'bash'),
    `${t('function', 'EXPO_TV=${A')} b} npx`
  );
});

test('colors bash commands only at the start of a line', () => {
  assert.equal(
    highlightCode('cd a && npm run x > out 2>&1 | cat', 'bash'),
    `${t('function', 'cd')} a ${t('keyword', '&amp;&amp;')} npm run x ${t('keyword', '&gt;')} out 2${t('keyword', '&gt;')}&amp;1 ${t('keyword', '|')} cat`
  );
});

test('keeps a backslash literal in single quotes', () => {
  assert.equal(
    highlightCode("echo 'a\\'b'", 'bash'),
    `echo ${t('string', "'a\\'")}b${t('string', "'")}`
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
  assert.equal(highlightCode('a=', 'properties'), `${t('attr-name', 'a')}=`);
  assert.equal(
    highlightCode('[[tool.src]]\nn = 1', 'toml'),
    `${t('keyword', '[[tool.src]]')}\n${t('attr-name', 'n')} = ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('[tool.x] # c\nk = true', 'toml'),
    `${t('keyword', '[tool.x]')} ${t('comment', '# c')}\n${t('attr-name', 'k')} = ${t('keyword', 'true')}`
  );
  // Classic Mac line endings leave several records in one "line".
  assert.equal(
    highlightCode('a=1\rb=2', 'properties'),
    `${t('attr-name', 'a')}=${t('string', '1')}\r${t('attr-name', 'b')}=${t('string', '2')}`
  );
});

test('colors a trailing comment as a comment, quotes and all', () => {
  assert.equal(
    highlightCode(
      'const a = 1; // Human-readable (if applicable)',
      'typescript'
    ),
    `${t('keyword', 'const')} a = ${t('number', '1')}; ${t('comment', '// Human-readable (if applicable)')}`
  );
  assert.equal(
    highlightCode('autoFinish: false  // We\'ll finish "later"', 'swift'),
    `autoFinish: ${t('keyword', 'false')}  ${t('comment', '// We\'ll finish "later"')}`
  );
  assert.equal(
    highlightCode("var a = 1 # don't color me", 'gdscript'),
    `${t('keyword', 'var')} a = ${t('number', '1')} ${t('comment', "# don't color me")}`
  );
});

test('colors block comments, also over several lines', () => {
  assert.equal(
    highlightCode('{/* Original price */}', 'typescript'),
    `{${t('comment', '/* Original price */')}}`
  );
  assert.equal(
    highlightCode('/**\n * if 42\n */\nfun f() {} // tail', 'kotlin'),
    `${t('comment', '/**\n * if 42\n */')}\n${t('keyword', 'fun')} ${t('function', 'f')}() {} ${t('comment', '// tail')}`
  );
  assert.equal(
    highlightCode('a /* open\nb', 'dart'),
    `a ${t('comment', '/* open')}\nb`
  );
});

test('starts a GDScript comment at any #', () => {
  assert.equal(highlightCode('a#b', 'gdscript'), `a${t('comment', '#b')}`);
});

test('starts a bash or YAML comment only at a word', () => {
  assert.equal(
    highlightCode('echo ${#arr[@]} a#b # note\nnpm run x # n', 'bash'),
    `echo ${t('variable', '${#arr[@]}')} a#b ${t('comment', '# note')}\n${t('function', 'npm')} run x ${t('comment', '# n')}`
  );
  assert.equal(
    highlightCode('url: "http://a#b" # note\n# all', 'yaml'),
    `${t('attr-name', 'url')}: ${t('string', '"http://a#b"')} ${t('comment', '# note')}\n${t('comment', '# all')}`
  );
  assert.equal(
    highlightCode('! bang\n# hash\na=b # kept', 'properties'),
    `${t('comment', '! bang')}\n${t('comment', '# hash')}\n${t('attr-name', 'a')}=${t('string', 'b # kept')}`
  );
});

test('keeps a multi-line string whole', () => {
  assert.equal(
    highlightCode('const s = `one\ntwo ${x}`;\nfoo();', 'typescript'),
    `${t('keyword', 'const')} s = ${t('string', '`one\ntwo ${x}`')};\n${t('function', 'foo')}();`
  );
  assert.equal(
    highlightCode('val j = """\n  {"a": 1}\n"""\nprintln(j)', 'kotlin'),
    `${t('keyword', 'val')} j = ${t('string', '"""\n  {"a": 1}\n"""')}\n${t('function', 'println')}(j)`
  );
});

test('colors annotations and leaves a C# @identifier alone', () => {
  assert.equal(
    highlightCode('@Composable\nfun Screen(vm: ViewModel) {}', 'kotlin'),
    `${t('decorator', '@Composable')}\n${t('keyword', 'fun')} ${t('function', 'Screen')}(vm: ${t('class-name', 'ViewModel')}) {}`
  );
  assert.equal(
    highlightCode('f(_ l: @escaping (String) -> Void)', 'swift'),
    `${t('function', 'f')}(_ l: ${t('decorator', '@escaping')} (${t('class-name', 'String')}) -&gt; ${t('class-name', 'Void')})`
  );
  assert.equal(
    highlightCode('var a = @params;', 'csharp'),
    `${t('keyword', 'var')} a = @params;`
  );
});

test('colors compiler directives as keywords', () => {
  assert.equal(
    highlightCode('#if DEBUG\nlog(true)\n#endif', 'swift'),
    `${t('keyword', '#if')} ${t('class-name', 'DEBUG')}\n${t('function', 'log')}(${t('keyword', 'true')})\n${t('keyword', '#endif')}`
  );
});

test('takes only a lowercase #name for a directive', () => {
  assert.equal(highlightCode('#If x', 'swift'), `#${t('class-name', 'If')} x`);
});

test('tells JSON keys from values', () => {
  assert.equal(
    highlightCode('{"a:b": "c:d", "n": [1, true, null]}', 'json'),
    `{${t('attr-name', '"a:b"')}: ${t('string', '"c:d"')}, ${t('attr-name', '"n"')}: [${t('number', '1')}, ${t('keyword', 'true')}, ${t('keyword', 'null')}]}`
  );
  assert.equal(
    highlightCode('{"a" : 1}', 'json'),
    `{${t('attr-name', '"a"')} : ${t('number', '1')}}`
  );
});

test('colors GraphQL field types and trailing comments', () => {
  assert.equal(
    highlightCode('  name: [String!]!   # note: kept', 'graphql'),
    `  ${t('field', 'name')}${t('punctuation', ':')} ${t('punctuation', '[')}${t('builtin-type', 'String')}${t('required', '!')}${t('punctuation', ']')}${t('required', '!')}   ${t('comment', '# note: kept')}`
  );
  assert.equal(
    highlightCode('  field(arg: Int = 1): Foo', 'graphql'),
    `  field(${t('field', 'arg')}${t('punctuation', ':')} ${t('builtin-type', 'Int')} = 1)${t('punctuation', ':')} ${t('custom-type', 'Foo')}`
  );
  assert.equal(
    highlightCode('  n: String = "#fff" # c', 'graphql'),
    `  ${t('field', 'n')}${t('punctuation', ':')} ${t('builtin-type', 'String')} = ${t('string', '"#fff"')} ${t('comment', '# c')}`
  );
});

test('colors the fields of a one-line GraphQL definition', () => {
  assert.equal(
    highlightCode('type Query { users: [User!]! }', 'graphql'),
    `${t('keyword', 'type')} ${t('type-name', 'Query')} { ${t('field', 'users')}${t('punctuation', ':')} ${t('punctuation', '[')}${t('custom-type', 'User')}${t('required', '!')}${t('punctuation', ']')}${t('required', '!')} }`
  );
  assert.equal(
    highlightCode('query Q($id: ID!) {', 'graphql'),
    `${t('keyword', 'query')} ${t('type-name', 'Q')}($id${t('punctuation', ':')} ${t('builtin-type', 'ID')}${t('required', '!')}) {`
  );
});

test('colors GraphQL declarations, enum values and block strings', () => {
  assert.equal(
    highlightCode('type  Foo {', 'graphql'),
    `${t('keyword', 'type')}  ${t('type-name', 'Foo')} {`
  );
  assert.equal(
    highlightCode('extend interface Node {', 'graphql'),
    `${t('keyword', 'extend interface')} ${t('type-name', 'Node')} {`
  );
  assert.equal(
    highlightCode('  TIER_1 # first', 'graphql'),
    `  ${t('enum-value', 'TIER_1')} ${t('comment', '# first')}`
  );
  assert.equal(
    highlightCode('"""\nA: b\n"""\ntype A {', 'graphql'),
    `${t('string', '"""\nA: b\n"""')}\n${t('keyword', 'type')} ${t('type-name', 'A')} {`
  );
});

test('does not color a GraphQL alias or a string as a type', () => {
  for (const call of ['picture(size: 64)', 'picture (size: 64)']) {
    assert.equal(
      highlightCode(`  pic: ${call}`, 'graphql'),
      `  ${t('field', 'pic')}${t('punctuation', ':')} ${call.replace('size:', `${t('field', 'size')}${t('punctuation', ':')}`)}`
    );
  }
  assert.equal(
    highlightCode('  small: thumbnail { url }', 'graphql'),
    `  ${t('field', 'small')}${t('punctuation', ':')} thumbnail { url }`
  );
  assert.equal(
    highlightCode('  a: Int @deprecated(reason: "Use amount: x")', 'graphql'),
    `  ${t('field', 'a')}${t('punctuation', ':')} ${t('builtin-type', 'Int')} @deprecated(${t('field', 'reason')}${t('punctuation', ':')} ${t('string', '"Use amount: x"')})`
  );
});

test('closes a string after an escaped backslash', () => {
  assert.equal(
    highlightCode('{"path": "C:\\\\", "next": 1}', 'json'),
    `{${t('attr-name', '"path"')}: ${t('string', '"C:\\\\"')}, ${t('attr-name', '"next"')}: ${t('number', '1')}}`
  );
  assert.equal(
    highlightCode('  join(sep: String = "\\\\"): String', 'graphql'),
    `  join(${t('field', 'sep')}${t('punctuation', ':')} ${t('builtin-type', 'String')} = ${t('string', '"\\\\"')})${t('punctuation', ':')} ${t('builtin-type', 'String')}`
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

test('ends a string at a line break, and honors escapes in all quote kinds', () => {
  assert.equal(
    highlightCode('x = "a\nb"', 'typescript'),
    `x = ${t('string', '"a')}\nb${t('string', '"')}`
  );
  assert.equal(
    highlightCode("x = 'it\\'s'", 'typescript'),
    `x = ${t('string', "'it\\'s'")}`
  );
  assert.equal(
    highlightCode('x = `a\\`b`', 'typescript'),
    `x = ${t('string', '`a\\`b`')}`
  );
});

test('ends an unclosed block comment, template or triple quote at the line', () => {
  assert.equal(
    highlightCode('a /* b\nfoo()', 'typescript'),
    `a ${t('comment', '/* b')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('x = `a\nfoo()', 'typescript'),
    `x = ${t('string', '`a')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('x = """abc\nfoo()', 'kotlin'),
    `x = ${t('string', '"""abc')}\n${t('function', 'foo')}()`
  );
});

test('colors Kotlin chars, Dart triple quotes and an indented C# directive', () => {
  assert.equal(
    highlightCode("val c = 'a'", 'kotlin'),
    `${t('keyword', 'val')} c = ${t('string', "'a'")}`
  );
  assert.equal(
    highlightCode("var s = '''x'''", 'dart'),
    `${t('keyword', 'var')} s = ${t('string', "'''x'''")}`
  );
  assert.equal(
    highlightCode('  #region X', 'csharp'),
    `  ${t('keyword', '#region')} ${t('class-name', 'X')}`
  );
});

test('colors whole numeric literals', () => {
  assert.equal(
    highlightCode(
      'x = 0.1f + 0xFF_FF + 1_000 + 1.0_5 + 10L + 1e3 + 2.5e-3',
      'kotlin'
    ),
    `x = ${t('number', '0.1f')} + ${t('number', '0xFF_FF')} + ${t('number', '1_000')} + ${t('number', '1.0_5')} + ${t('number', '10L')} + ${t('number', '1e3')} + ${t('number', '2.5e-3')}`
  );
  assert.equal(
    highlightCode(
      'x = 0b1010_1010 + 0B1 + 0XFF + 0o17 + 0O7 + 10UL + 1.5M + 1m + 1u + 1d',
      'swift'
    ),
    `x = ${t('number', '0b1010_1010')} + ${t('number', '0B1')} + ${t('number', '0XFF')} + ${t('number', '0o17')} + ${t('number', '0O7')} + ${t('number', '10UL')} + ${t('number', '1.5M')} + ${t('number', '1m')} + ${t('number', '1u')} + ${t('number', '1d')}`
  );
  assert.equal(highlightCode('v2 + 4K', 'kotlin'), 'v2 + 4K');
});

test('leaves a unit suffix out of a number in JSON, YAML and TOML', () => {
  assert.equal(
    highlightCode('timeout: 10m\nkeep: 7d\nsize: 1.5M\nlimit: 0xFF', 'yaml'),
    `${t('attr-name', 'timeout')}: 10m\n${t('attr-name', 'keep')}: 7d\n${t('attr-name', 'size')}: 1.5M\n${t('attr-name', 'limit')}: ${t('number', '0xFF')}`
  );
  assert.equal(
    highlightCode('{"a": 1e3, "b": -2.5, "c": 10m}', 'json'),
    `{${t('attr-name', '"a"')}: ${t('number', '1e3')}, ${t('attr-name', '"b"')}: -${t('number', '2.5')}, ${t('attr-name', '"c"')}: 10m}`
  );
  assert.equal(
    highlightCode('n = 1_000', 'toml'),
    `${t('attr-name', 'n')} = ${t('number', '1_000')}`
  );
});

test('takes $ as part of a call name and keeps a dot out of a number', () => {
  assert.equal(
    highlightCode('a$b(1)', 'typescript'),
    `${t('function', 'a$b')}(${t('number', '1')})`
  );
  assert.equal(
    highlightCode('val p = 16.dp + 1.5', 'kotlin'),
    `${t('keyword', 'val')} p = ${t('number', '16')}.dp + ${t('number', '1.5')}`
  );
  assert.equal(
    highlightCode('pair.0.self', 'swift'),
    `pair.${t('number', '0')}.${t('keyword', 'self')}`
  );
});

test('colors bash strings, redirects and variables', () => {
  assert.equal(
    highlightCode(`echo "a b" 'c d' $HOME < in`, 'bash'),
    `echo ${t('string', '"a b"')} ${t('string', "'c d'")} ${t('variable', '$HOME')} ${t('keyword', '&lt;')} in`
  );
  assert.equal(
    highlightCode('EXPO_TV="a b" npx expo start', 'bash'),
    `EXPO_TV=${t('string', '"a b"')} npx expo start`
  );
});

test('does not take a # inside a YAML single-quoted string for a comment', () => {
  assert.equal(
    highlightCode("k: 'v # x'", 'yaml'),
    `${t('attr-name', 'k')}: ${t('string', "'v # x'")}`
  );
});

test('colors GraphQL keywords only at column 0', () => {
  assert.equal(
    highlightCode('  subscription { productId }', 'graphql'),
    '  subscription { productId }'
  );
  assert.equal(
    highlightCode('typeName: String', 'graphql'),
    `${t('field', 'typeName')}${t('punctuation', ':')} ${t('builtin-type', 'String')}`
  );
  assert.equal(
    highlightCode(
      'union X = A | B\nfragment F on T {\nmutation M {\ndirective @d on FIELD\nscalar Date\nschema {\nquery($id: ID!) {',
      'graphql'
    ),
    `${t('keyword', 'union')} ${t('type-name', 'X')} = A | B\n${t('keyword', 'fragment')} ${t('type-name', 'F')} on T {\n${t('keyword', 'mutation')} ${t('type-name', 'M')} {\n${t('keyword', 'directive')} @d on FIELD\n${t('keyword', 'scalar')} ${t('type-name', 'Date')}\n${t('keyword', 'schema')} {\n${t('keyword', 'query')}($id${t('punctuation', ':')} ${t('builtin-type', 'ID')}${t('required', '!')}) {`
  );
});

test('ends a GraphQL block string at the right quotes', () => {
  assert.equal(
    highlightCode('"""abc\nf: Int', 'graphql'),
    `${t('string', '"""abc')}\n${t('field', 'f')}${t('punctuation', ':')} ${t('builtin-type', 'Int')}`
  );
  assert.equal(
    highlightCode('"""a \\""" b"""\ntype X {', 'graphql'),
    `${t('string', '"""a \\""" b"""')}\n${t('keyword', 'type')} ${t('type-name', 'X')} {`
  );
});

test('colors a GraphQL keyword before a brace or at the end of a line', () => {
  assert.equal(
    highlightCode('query{ a }', 'graphql'),
    `${t('keyword', 'query')}{ a }`
  );
  assert.equal(
    highlightCode('schema\nx', 'graphql'),
    `${t('keyword', 'schema')}\nx`
  );
});

test('does not read an escaped triple quote as the end of a block string', () => {
  assert.equal(
    highlightCode('"""a\n\\""" b\nc"""\ntype Y', 'graphql'),
    `${t('string', '"""a\n\\""" b\nc"""')}\n${t('keyword', 'type')} ${t('type-name', 'Y')}`
  );
  assert.equal(
    highlightCode('"""a \\""" b\ntype X {', 'graphql'),
    `${t('string', '"""a \\""" b')}\n${t('keyword', 'type')} ${t('type-name', 'X')} {`
  );
});

test('keeps a TOML header indented and stops EXPO_TV at either quote', () => {
  assert.equal(highlightCode('  [x]', 'toml'), `  ${t('keyword', '[x]')}`);
  assert.equal(
    highlightCode("EXPO_TV='1' npx", 'bash'),
    `EXPO_TV=${t('string', "'1'")} npx`
  );
});

test('ends an unclosed Dart triple quote at the line', () => {
  assert.equal(
    highlightCode("x = '''a\nfoo()", 'dart'),
    `x = ${t('string', "'''a")}\n${t('function', 'foo')}()`
  );
});

test('starts a properties key at any non-blank character', () => {
  assert.equal(
    highlightCode('\u00a0k=v', 'properties'),
    `${t('attr-name', '\u00a0k')}=${t('string', 'v')}`
  );
});

test('escapes the text of a language it does not know', () => {
  for (const language of ['python', 'toString', 'constructor', '__proto__']) {
    assert.equal(highlightCode('<b>x</b>', language), '&lt;b&gt;x&lt;/b&gt;');
  }
});

test('does not take an upper-case field name for an enum value', () => {
  assert.equal(
    highlightCode('  URL: String', 'graphql'),
    `  ${t('field', 'URL')}${t('punctuation', ':')} ${t('builtin-type', 'String')}`
  );
});

test('colors nested GraphQL lists and a space before the colon', () => {
  assert.equal(
    highlightCode('  n: [[A!]!]!\n  a : Int', 'graphql'),
    `  ${t('field', 'n')}${t('punctuation', ':')} ${t('punctuation', '[')}${t('punctuation', '[')}${t('custom-type', 'A')}${t('required', '!')}${t('punctuation', ']')}${t('required', '!')}${t('punctuation', ']')}${t('required', '!')}\n  ${t('field', 'a')} ${t('punctuation', ':')} ${t('builtin-type', 'Int')}`
  );
});

test('stays fast on long pathological lines', () => {
  const inputs = [
    ' '.repeat(50000),
    'x' + ' '.repeat(50000),
    'a' + ' '.repeat(50000) + 'b=c',
    'k'.repeat(50000),
    '/* '.repeat(5000),
    '`'.repeat(5000),
    'a$'.repeat(2000),
    '"""'.repeat(3000),
    'a: '.repeat(5000),
  ];
  for (const language of HIGHLIGHT_LANGUAGES) {
    for (const source of inputs) {
      const start = performance.now();
      highlightCode(source, language);
      const elapsed = performance.now() - start;
      assert.ok(
        elapsed < 1000,
        `${language} ${JSON.stringify(source.slice(0, 12))} ${elapsed}ms`
      );
    }
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
  '/*',
  '*/',
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
  '"""',
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
  '@params',
  '#if',
  'foo (x)',
  'a=b',
  'a = b',
  'key: v',
  'x:Int',
  '[ID!]!',
  '# note: v',
  '! note',
  'type',
  'enum',
  'interface Node',
  'TIER_1',
  '[section]',
  'EXPO_TV=$X',
  '${a -b}',
  '${#a}',
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
