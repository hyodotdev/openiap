import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HIGHLIGHT_LANGUAGES,
  escapeHtml,
  highlightCode,
} from '../src/lib/codeHighlight.ts';

const t = (type, text) => `<span class="token ${type}">${text}</span>`;
const highlightXml = (source) => highlightCode(source, 'xml');

// ⟦type:text⟧ stands for a token span, so a table row reads like the output.
const marked = (notation) =>
  escapeHtml(notation).replace(/⟦([a-z-]+):([^⟧]*)⟧/g, (_, type, text) =>
    t(type, text)
  );

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

test('ends an XML comment only at -->', () => {
  assert.equal(
    highlightXml('<!-- a -> b -->'),
    t('comment', '&lt;!-- a -&gt; b --&gt;')
  );
});

test('ends an unclosed XML comment at its line', () => {
  assert.equal(
    highlightXml('<!-- a <b>x</b>\n<c/>'),
    `${t('comment', '&lt;!-- a &lt;b&gt;x&lt;/b&gt;')}\n${t('punctuation', '&lt;')}${t('tag', 'c')}${t('punctuation', '/&gt;')}`
  );
});

test('stops a broken tag at the next one', () => {
  assert.equal(
    highlightXml('<a\n<b c="d">'),
    '&lt;a\n<span class="token punctuation">&lt;</span><span class="token tag">b</span> <span class="token attr-name">c</span>=<span class="token attr-value">"d"</span><span class="token punctuation">&gt;</span>'
  );
});

test('ends a tag at its first unquoted >', () => {
  assert.equal(
    highlightXml('<a>1 > 0</a>'),
    `${t('punctuation', '&lt;')}${t('tag', 'a')}${t('punctuation', '&gt;')}1 &gt; 0${t('punctuation', '&lt;/')}${t('tag', 'a')}${t('punctuation', '&gt;')}`
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

test('nests block comments in Kotlin, Swift and Dart only', () => {
  const source = 'a /* b /* c */ d */ e';
  for (const language of ['kotlin', 'swift', 'dart']) {
    assert.equal(
      highlightCode(source, language),
      `a ${t('comment', '/* b /* c */ d */')} e`,
      language
    );
  }
  for (const language of ['typescript', 'csharp', 'groovy']) {
    assert.equal(
      highlightCode(source, language),
      `a ${t('comment', '/* b /* c */')} d */ e`,
      language
    );
  }
});

test('does not close a comment with the star of its own opener', () => {
  for (const language of ['typescript', 'csharp', 'groovy', 'kotlin']) {
    assert.equal(
      highlightCode('/*/ x */ y', language),
      `${t('comment', '/*/ x */')} y`,
      language
    );
  }
});

test('closes an empty comment and each of two on one line', () => {
  for (const language of ['typescript', 'kotlin']) {
    assert.equal(
      highlightCode('a /**/ b /* c */ d', language),
      `a ${t('comment', '/**/')} b ${t('comment', '/* c */')} d`,
      language
    );
    assert.equal(
      highlightCode('a /**/ b', language),
      `a ${t('comment', '/**/')} b`,
      language
    );
  }
});

test('ends an unclosed nested comment at its line and keeps the closed ones', () => {
  assert.equal(
    highlightCode('/* a /* b */\nfoo()', 'kotlin'),
    `${t('comment', '/* a /* b */')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('/* x\n/* y */\nfoo()', 'swift'),
    `${t('comment', '/* x')}\n${t('comment', '/* y */')}\n${t('function', 'foo')}()`
  );
});

test('reads nested comments like the plain reading, also around */* and /*/', () => {
  // A plain reading of Kotlin comments, to hold the fast one against.
  function readComments(source) {
    const lineEnd = (from) => {
      const newline = source.indexOf('\n', from);
      return newline < 0 ? source.length : newline;
    };
    const delimiter = (at) =>
      source.startsWith('/*', at) ? 1 : source.startsWith('*/', at) ? -1 : 0;
    let html = '';
    for (let i = 0; i < source.length; ) {
      let end = i + 1;
      if (source.startsWith('//', i)) end = lineEnd(i);
      else if (source.startsWith('/*', i)) {
        let depth = 1;
        end = i + 2;
        while (end < source.length && depth > 0) {
          const step = delimiter(end);
          depth += step;
          end += step ? 2 : 1;
        }
        if (depth > 0) end = lineEnd(i + 2);
      } else {
        html += source[i++];
        continue;
      }
      html += t('comment', source.slice(i, end));
      i = end;
    }
    return html;
  }
  const next = random(7);
  const pieces = ['/*', '*/', '/*', '*/', '/', '*', '//', 'x', ' ', '\n', '\n'];
  for (let i = 0; i < 3000; i++) {
    let source = '';
    for (let n = 1 + Math.floor(next() * 14); n > 0; n--) {
      source += pieces[Math.floor(next() * pieces.length)];
    }
    for (const language of ['kotlin', 'swift', 'dart']) {
      assert.equal(
        highlightCode(source, language),
        readComments(source),
        `${language} ${JSON.stringify(source)}`
      );
    }
  }
});

test('starts a GDScript comment at any #', () => {
  assert.equal(highlightCode('a#b', 'gdscript'), `a${t('comment', '#b')}`);
});

test('starts a bash or YAML comment only at a word', () => {
  assert.equal(
    highlightCode('echo a\t# c', 'bash'),
    `echo a\t${t('comment', '# c')}`
  );
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

test('lets a backslash end a line inside a template or GDScript string', () => {
  assert.equal(
    highlightCode('x = `a\\\nb`; foo();', 'typescript'),
    `x = ${t('string', '`a\\\nb`')}; ${t('function', 'foo')}();`
  );
  assert.equal(
    highlightCode('x = "a\\\nb"; y = 1', 'gdscript'),
    `x = ${t('string', '"a\\\nb"')}; y = ${t('number', '1')}`
  );
});

test('lets a GDScript string hold a line break', () => {
  assert.equal(
    highlightCode('var s = "a\nb"\nvar t = \'c\nd\'\nfoo()', 'gdscript'),
    `${t('keyword', 'var')} s = ${t('string', '"a\nb"')}\n${t('keyword', 'var')} t = ${t('string', "'c\nd'")}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('x = "a\\"\nb"; y = 1', 'gdscript'),
    `x = ${t('string', '"a\\"\nb"')}; y = ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('x = "a\nfoo()', 'gdscript'),
    `x = ${t('string', '"a')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode("x = 'a\nfoo()", 'gdscript'),
    `x = ${t('string', "'a")}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('x = \\"a\nfoo()', 'gdscript'),
    `x = \\"a\n${t('function', 'foo')}()`
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

test('does not take a label for an annotation', () => {
  assert.equal(
    highlightCode('return@collect', 'kotlin'),
    `${t('keyword', 'return')}@collect`
  );
  assert.equal(
    highlightCode('f(this@MainActivity)', 'kotlin'),
    `${t('function', 'f')}(${t('keyword', 'this')}@${t('class-name', 'MainActivity')})`
  );
  assert.equal(
    highlightCode('loop@for (i in l) {}', 'kotlin'),
    `loop@${t('keyword', 'for')} (i ${t('keyword', 'in')} l) {}`
  );
  assert.equal(
    highlightCode('@A fun f(@B x: X)', 'kotlin'),
    `${t('decorator', '@A')} ${t('keyword', 'fun')} ${t('function', 'f')}(${t('decorator', '@B')} x: ${t('class-name', 'X')})`
  );
});

test('colors compiler directives as keywords', () => {
  assert.equal(
    highlightCode('#if DEBUG\nlog(true)\n#endif', 'swift'),
    `${t('keyword', '#if')} ${t('class-name', 'DEBUG')}\n${t('function', 'log')}(${t('keyword', 'true')})\n${t('keyword', '#endif')}`
  );
});

test('takes only a lowercase #name for a C# directive, and any #name in Swift', () => {
  assert.equal(highlightCode('#If x', 'csharp'), `#${t('class-name', 'If')} x`);
  assert.equal(
    highlightCode('#Preview { Text("a") }', 'swift'),
    `${t('keyword', '#Preview')} { ${t('function', 'Text')}(${t('string', '"a"')}) }`
  );
  assert.equal(
    highlightCode('if #available(iOS 15, *) { print(#function) }', 'swift'),
    `${t('keyword', 'if')} ${t('keyword', '#available')}(iOS ${t('number', '15')}, *) { ${t('function', 'print')}(${t('keyword', '#function')}) }`
  );
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

test('lets a backslash escape the next character in TypeScript code', () => {
  assert.equal(
    highlightCode('const r = /\\//; // end', 'typescript'),
    `${t('keyword', 'const')} r = ${t('regex', '/\\//')}; ${t('comment', '// end')}`
  );
  assert.equal(
    highlightCode('const r = /\\"/; y = 1', 'typescript'),
    `${t('keyword', 'const')} r = ${t('regex', '/\\"/')}; y = ${t('number', '1')}`
  );
  // Outside a regex literal too: `\/` is no comment, `\"` opens no string.
  assert.equal(highlightCode('a = b \\// c', 'typescript'), 'a = b \\// c');
});

test('opens a template at a backtick that follows a backslash', () => {
  // A regex literal with a backtick is no template.
  assert.equal(
    highlightCode(
      'const r = /`/;\nconst s = `a \\`b\\` c`;\nif (x) foo(`y`);',
      'typescript'
    ),
    `${t('keyword', 'const')} r = ${t('regex', '/`/')};\n${t('keyword', 'const')} s = ${t('string', '`a \\`b\\` c`')};\n${t('keyword', 'if')} (x) ${t('function', 'foo')}(${t('string', '`y`')});`
  );
  // After `)` a `/` divides, so this backtick throws the lexer out of step; an
  // escaped backtick later on has to get it back in step.
  assert.equal(
    highlightCode(
      'if (x) /`/.test(y);\nconst s = `a \\`b\\` c`;\nif (x) foo(`y`);',
      'typescript'
    ),
    `${t('keyword', 'if')} (x) /${t('string', '`/.test(y);\nconst s = `')}a \\${t('string', '`b\\` c`')};\n${t('keyword', 'if')} (x) ${t('function', 'foo')}(${t('string', '`y`')});`
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
  assert.equal(
    highlightCode(
      'x = 0xff + 0b102 + 0o78 + 1_0_0 + 1E5 + 1e+5 + 1e10 + 1.5F + 2D + 3l',
      'kotlin'
    ),
    `x = ${t('number', '0xff')} + 0b102 + 0o78 + ${t('number', '1_0_0')} + ${t('number', '1E5')} + ${t('number', '1e+5')} + ${t('number', '1e10')} + ${t('number', '1.5F')} + ${t('number', '2D')} + ${t('number', '3l')}`
  );
});

test('leaves a trailing underscore out of a number', () => {
  assert.equal(
    highlightCode('x = 1_ + 0x_ + 1__000 + 0xDE_AD + 0x_FF + 0b_01', 'kotlin'),
    `x = 1_ + 0x_ + ${t('number', '1__000')} + ${t('number', '0xDE_AD')} + ${t('number', '0x_FF')} + ${t('number', '0b_01')}`
  );
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
    highlightCode('$el(1) + x.$el(2)', 'typescript'),
    `${t('function', '$el')}(${t('number', '1')}) + x.${t('function', '$el')}(${t('number', '2')})`
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

test('colors an unclosed bash ${ to the end of the line', () => {
  assert.equal(
    highlightCode('echo ${abc\nnext', 'bash'),
    `echo ${t('variable', '${abc')}\nnext`
  );
});

test('lets a bash backslash escape the next character', () => {
  assert.equal(
    highlightCode('echo \\$HOME \\"a\\" \\\'b\\\' \\# c', 'bash'),
    'echo \\$HOME \\"a\\" \\\'b\\\' \\# c'
  );
  assert.equal(
    highlightCode('npm run \\\n  --flag # n', 'bash'),
    `${t('function', 'npm')} run \\\n  ${t('attr-name', '--flag')} ${t('comment', '# n')}`
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

test('does not open a GraphQL block string at an escaped triple quote', () => {
  assert.equal(
    highlightCode('\\"""abc\nf: Int', 'graphql'),
    `\\"""abc\n${t('field', 'f')}${t('punctuation', ':')} ${t('builtin-type', 'Int')}`
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

test('starts a TOML comment at any # but a YAML one only after a space', () => {
  assert.equal(
    highlightCode('a=1#c\nb = "x#y" # z\n[s]#t', 'toml'),
    `${t('attr-name', 'a')}=${t('number', '1')}${t('comment', '#c')}\n${t('attr-name', 'b')} = ${t('string', '"x#y"')} ${t('comment', '# z')}\n${t('keyword', '[s]')}${t('comment', '#t')}`
  );
  assert.equal(highlightCode('a: b#c', 'yaml'), `${t('attr-name', 'a')}: b#c`);
});

test('takes an apostrophe between letters in a YAML value as text unless a quote closes it', () => {
  assert.equal(
    highlightCode(
      "run: sed -e's/a/b/' f # c\nrun2: cut -d'x' -f2\nrun3: cut -d' ' -f1 # c\nkey: don't 'q' # c\nk2: 'v'\n- ['a']\nrun4: cut -d'\"' -f2\nok: true\nit: it's Bob's # c",
      'yaml'
    ),
    `${t('attr-name', 'run')}: sed -e${t('string', "'s/a/b/'")} f ${t('comment', '# c')}\n${t('attr-name', 'run2')}: cut -d${t('string', "'x'")} -f2\n${t('attr-name', 'run3')}: cut -d${t('string', "' '")} -f1 ${t('comment', '# c')}\n${t('attr-name', 'key')}: don't ${t('string', "'q'")} ${t('comment', '# c')}\n${t('attr-name', 'k2')}: ${t('string', "'v'")}\n- [${t('string', "'a'")}]\n${t('attr-name', 'run4')}: cut -d${t('string', "'\"'")} -f2\n${t('attr-name', 'ok')}: ${t('keyword', 'true')}\n${t('attr-name', 'it')}: it's Bob's ${t('comment', '# c')}`
  );
});

test('closes a TOML literal string and a multi-line one with quotes before the end', () => {
  assert.equal(
    highlightCode("k = 'v#w' # c", 'toml'),
    `${t('attr-name', 'k')} = ${t('string', "'v#w'")} ${t('comment', '# c')}`
  );
  assert.equal(
    highlightCode("s = ''''That,' she said.'''' # c", 'toml'),
    `${t('attr-name', 's')} = ${t('string', "''''That,' she said.''''")} ${t('comment', '# c')}`
  );
});

test('lets a backslash escape a quote in a TOML multi-line string and keep a literal one raw', () => {
  const line =
    'str = """Here are fifteen quotes: ""\\"""\\"""\\"""\\"""\\"."""';
  assert.equal(
    highlightCode(`${line} # c`, 'toml'),
    `${t('attr-name', 'str')} = ${t('string', line.slice(6))} ${t('comment', '# c')}`
  );
  // A '…' string takes no escapes, in TOML and in YAML.
  for (const [language, separator] of [
    ['toml', ' ='],
    ['yaml', ':'],
  ]) {
    assert.equal(
      highlightCode(`k${separator} 'C:\\' # c`, language),
      `${t('attr-name', 'k')}${separator} ${t('string', "'C:\\'")} ${t('comment', '# c')}`,
      language
    );
  }
});

test('keeps a TOML multi-line string whole', () => {
  assert.equal(
    highlightCode('s = """a\nb # not"""\nt = 1', 'toml'),
    `${t('attr-name', 's')} = ${t('string', '"""a\nb # not"""')}\n${t('attr-name', 't')} = ${t('number', '1')}`
  );
});

test('leaves a YAML flow sequence at the start of a line alone', () => {
  assert.equal(highlightCode('[a, b]', 'yaml'), '[a, b]');
});

test('ends an unclosed Dart triple quote at the line', () => {
  assert.equal(
    highlightCode("x = '''a\nfoo()", 'dart'),
    `x = ${t('string', "'''a")}\n${t('function', 'foo')}()`
  );
});

test('keeps a string whole when its holes hold quotes', () => {
  assert.equal(
    highlightCode(
      'text = "${a.currency} ${String.format("%.2f", b)}",',
      'kotlin'
    ),
    `text = ${t('string', '"${a.currency} ${String.format("%.2f", b)}"')},`
  );
  assert.equal(
    highlightCode('"${xs.joinToString { "[${it}]" }}" + 1', 'kotlin'),
    `${t('string', '"${xs.joinToString { "[${it}]" }}"')} + ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('"${if (c == \'}\') 1 else 2}" + 1', 'kotlin'),
    `${t('string', '"${if (c == \'}\') 1 else 2}"')} + ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('print("failed: \\(e ?? "")")', 'swift'),
    `${t('function', 'print')}(${t('string', '"failed: \\(e ?? "")"')})`
  );
  assert.equal(
    highlightCode('f($"P: {string.Join(", ", p)}");', 'csharp'),
    `${t('function', 'f')}($${t('string', '"P: {string.Join(", ", p)}"')});`
  );
  assert.equal(
    highlightCode(`print('a \${b ?? ""}' + "c \${d('e')}");`, 'dart'),
    `${t('function', 'print')}(${t('string', `'a \${b ?? ""}'`)} + ${t('string', `"c \${d('e')}"`)});`
  );
  assert.equal(
    highlightCode("print('p ${q('r')} s');", 'dart'),
    `${t('function', 'print')}(${t('string', "'p ${q('r')} s'")});`
  );
  assert.equal(
    highlightCode("print('a ${b('c ${d('e')}')}');", 'dart'),
    `${t('function', 'print')}(${t('string', "'a ${b('c ${d('e')}')}'")});`
  );
  assert.equal(
    highlightCode('x = "${a ? "p" : "q"}" + 1', 'groovy'),
    `x = ${t('string', '"${a ? "p" : "q"}"')} + ${t('number', '1')}`
  );
  assert.equal(
    highlightCode('cd "$(dirname "$0")" && echo "${a:-"b"}"', 'bash'),
    `${t('function', 'cd')} ${t('string', '"$(dirname "$0")"')} ${t('keyword', '&amp;&amp;')} echo ${t('string', '"${a:-"b"}"')}`
  );
});

test('keeps a template literal whole when its holes hold templates or backticks', () => {
  assert.equal(
    highlightCode('x = `a ${b ? `c ${d}` : "e"} f` + 1;', 'typescript'),
    `x = ${t('string', '`a ${b ? `c ${d}` : "e"} f`')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = `a ${b ? `c ${`d`}` : 1} e` + 1;', 'typescript'),
    `x = ${t('string', '`a ${b ? `c ${`d`}` : 1} e`')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode("x = `a ${b ? `c ${'`'} d` : 1} e` + 1;", 'typescript'),
    `x = ${t('string', "`a ${b ? `c ${'`'} d` : 1} e`")} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = `a ${b ? `}` : 1} e` + 1;', 'typescript'),
    `x = ${t('string', '`a ${b ? `}` : 1} e`')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode("x = `${'`'}` + 1;", 'typescript'),
    `x = ${t('string', "`${'`'}`")} + ${t('number', '1')};`
  );
  // A template and its hole run past the line.
  assert.equal(
    highlightCode('x = `a ${b\nc}`;\nfoo();', 'typescript'),
    `x = ${t('string', '`a ${b\nc}`')};\n${t('function', 'foo')}();`
  );
  assert.equal(
    highlightCode('x = `a ${b\nfoo();', 'typescript'),
    `x = ${t('string', '`a ${b')}\n${t('function', 'foo')}();`
  );
});

test('reads strings, holes and heredocs that run past a line', () => {
  const forms = [
    // A template and its holes go on to the next lines; a nested template or
    // a quoted backtick in a hole does not end it.
    [
      'typescript',
      'x = `a\n${b.map((c) => `<${c}>`)}\nz`; f(1)',
      'x = ⟦string:`a\n${b.map((c) => `<${c}>`)}\nz`⟧; ⟦function:f⟧(⟦number:1⟧)',
    ],
    [
      'typescript',
      'x = `a ${f(\n  "`",\n  y\n)} b`; g(1)',
      'x = ⟦string:`a ${f(\n  "`",\n  y\n)} b`⟧; ⟦function:g⟧(⟦number:1⟧)',
    ],
    [
      'typescript',
      "x = `${a ? `b\n${c}` : '`'}`; h(1)",
      "x = ⟦string:`${a ? `b\n${c}` : '`'}`⟧; ⟦function:h⟧(⟦number:1⟧)",
    ],
    // A string in a hole stays on its line, so this hole is read flat.
    [
      'typescript',
      'x = `a ${"b\nc"} d`; f(1)',
      'x = ⟦string:`a ${"b\nc"} d`⟧; ⟦function:f⟧(⟦number:1⟧)',
    ],
    [
      'typescript',
      'x = `a ${b\nc\n`; f(1)',
      'x = ⟦string:`a ${b\nc\n`⟧; ⟦function:f⟧(⟦number:1⟧)',
    ],
    // A hole may span lines in Kotlin, Dart, C# and Groovy, but not in Swift.
    [
      'kotlin',
      'val s = "a ${xs.map {\n  "x" }} b"\nf(1)',
      '⟦keyword:val⟧ s = ⟦string:"a ${xs.map {\n  "x" }} b"⟧\n⟦function:f⟧(⟦number:1⟧)',
    ],
    [
      'dart',
      "var s = 'a ${xs.map((x) {\n  return 'x';\n})} b';\nf(1);",
      "⟦keyword:var⟧ s = ⟦string:'a ${xs.map((x) {\n  return 'x';\n})} b'⟧;\n⟦function:f⟧(⟦number:1⟧);",
    ],
    [
      'csharp',
      'var s = $"a {xs.Select(x =>\n  x + "!")} b";\nf(1);',
      '⟦keyword:var⟧ s = $⟦string:"a {xs.Select(x =>\n  x + "!")} b"⟧;\n⟦function:f⟧(⟦number:1⟧);',
    ],
    [
      'csharp',
      'var s = @$"a {x}\n{y} b";\nf(1);',
      '⟦keyword:var⟧ s = ⟦string:@$"a {x}\n{y} b"⟧;\n⟦function:f⟧(⟦number:1⟧);',
    ],
    [
      'csharp',
      'var s = @$"a\n{f("x")} b";\nf(1);',
      '⟦keyword:var⟧ s = ⟦string:@$"a\n{f("x")} b"⟧;\n⟦function:f⟧(⟦number:1⟧);',
    ],
    [
      'groovy',
      'def s = "a ${xs.collect {\n  "x" }} b"\nf(1)',
      '⟦keyword:def⟧ s = ⟦string:"a ${xs.collect {\n  "x" }} b"⟧\n⟦function:f⟧(⟦number:1⟧)',
    ],
    // A raw string in a Dart hole ends at its quote, also after a backslash.
    [
      'dart',
      'x = "${f(r\'\\\', "y")}" + 1',
      'x = ⟦string:"${f(r\'\\\', "y")}"⟧ + ⟦number:1⟧',
    ],
    [
      'swift',
      'let s = #"a \\#"# b"# + x',
      '⟦keyword:let⟧ s = ⟦string:#"a \\#"# b"#⟧ + x',
    ],
    [
      'groovy',
      'def b = "x ${f("y")}\\\r\nz"',
      '⟦keyword:def⟧ b = ⟦string:"x ${f("y")}\\\r\nz"⟧',
    ],
    // A string in a hole ends at its line, so the hole is read flat.
    [
      'kotlin',
      'val s = "a ${f("x\ny")} b"\nz(1)',
      '⟦keyword:val⟧ s = ⟦string:"a ${f("⟧x\ny⟦string:")} b"⟧\n⟦function:z⟧(⟦number:1⟧)',
    ],
    [
      'groovy',
      'def s = "a\\\nb ${ c" d',
      '⟦keyword:def⟧ s = ⟦string:"a\\\nb ${ c"⟧ d',
    ],
    [
      'swift',
      'let s = "a \\(x\n) b"\nf(1)',
      '⟦keyword:let⟧ s = ⟦string:"a \\(x⟧\n) b⟦string:"⟧\n⟦function:f⟧(⟦number:1⟧)',
    ],
    // Bash strings hold line breaks, and a $( hole is shell code.
    [
      'bash',
      'v="$(\n  sed -n \'s/.*("\\(a\\)").*/\\1/p\' f\n)"\nls',
      'v=⟦string:"$(\n  sed -n \'s/.*("\\(a\\)").*/\\1/p\' f\n)"⟧\nls',
    ],
    [
      'bash',
      'python3 -c \'\nprint("hi")\n\'\nls',
      'python3 ⟦attr-name:-c⟧ ⟦string:\'\nprint("hi")\n\'⟧\nls',
    ],
    ['bash', 'echo "a ${ b\nc" d', 'echo ⟦string:"a ${ b\nc"⟧ d'],
    ['bash', 'echo "${a:-\n"x"}" ls', 'echo ⟦string:"${a:-\n"x"}"⟧ ls'],
    [
      'bash',
      'v="$(sed -n \'a"\nb\' f)"\nls',
      'v=⟦string:"$(sed -n \'a"\nb\' f)"⟧\nls',
    ],
    ['bash', 'echo "a\nb', 'echo ⟦string:"a⟧\nb'],
    ['bash', 'echo "$(\\\n" && ls', 'echo ⟦string:"$(\\\n"⟧ ⟦keyword:&&⟧ ls'],
    ['bash', "echo 'a\nb", "echo ⟦string:'a⟧\nb"],
    // A heredoc body runs from the next line to a line with only the word.
    [
      'bash',
      'cat <<EOF > f\nhi $x\nEOF\nls',
      'cat ⟦keyword:<<⟧⟦string:EOF⟧ ⟦keyword:>⟧ f\n⟦string:hi $x\nEOF⟧\nls',
    ],
    [
      'bash',
      "python3 - <<'PY' | tee o\nprint('it')\nPY\nls",
      "python3 - ⟦keyword:<<⟧⟦string:'PY'⟧ ⟦keyword:|⟧ tee o\n⟦string:print('it')\nPY⟧\nls",
    ],
    [
      'bash',
      'cat << "E"\n"x"\nE\nls',
      'cat ⟦keyword:<<⟧ ⟦string:"E"⟧\n⟦string:"x"\nE⟧\nls',
    ],
    [
      'bash',
      'cat <<\\E\nx\nE\nls',
      'cat ⟦keyword:<<⟧⟦string:\\E⟧\n⟦string:x\nE⟧\nls',
    ],
    // `<<-` lets tabs lead the closing line; plain `<<` does not.
    [
      'bash',
      'cat <<-E\n\tx\n\tE\nls',
      'cat ⟦keyword:<<-⟧⟦string:E⟧\n⟦string:\tx\n\tE⟧\nls',
    ],
    [
      'bash',
      'cat <<E\n\tE\nE\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:\tE\nE⟧\nls',
    ],
    // Two heredocs on a line take their bodies in turn.
    [
      'bash',
      'cat <<A <<B\none\nA\ntwo\nB\nls',
      'cat ⟦keyword:<<⟧⟦string:A⟧ ⟦keyword:<<⟧⟦string:B⟧\n⟦string:one\nA⟧\n⟦string:two\nB⟧\nls',
    ],
    ['bash', 'cat <<E\nE\nls', 'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:E⟧\nls'],
    [
      'bash',
      'cat <<"1"\nx\n1\nls',
      'cat ⟦keyword:<<⟧⟦string:"1"⟧\n⟦string:x\n1⟧\nls',
    ],
    [
      'bash',
      'echo $(( (a) << 2 ))\n2\nls',
      'echo $(( (a) ⟦keyword:<⟧⟦keyword:<⟧ 2 ))\n2\nls',
    ],
    // Earlier lines do not count, and a `))` first leaves nothing open.
    [
      'bash',
      '(( a\ncat <<E\nx\nE\nls',
      '(( a\ncat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:x\nE⟧\nls',
    ],
    [
      'bash',
      'x)) $(( 1 << 2 ))\n2\nls',
      'x)) $(( 1 ⟦keyword:<⟧⟦keyword:<⟧ 2 ))\n2\nls',
    ],
    [
      'bash',
      'echo "a\\"((b" <<EOF\nx\nEOF\nls',
      'echo ⟦string:"a\\"((b"⟧ ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls',
    ],
    [
      'bash',
      'echo "a" "((" <<EOF\nx\nEOF\nls',
      'echo ⟦string:"a"⟧ ⟦string:"(("⟧ ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls',
    ],
    [
      'bash',
      'echo "a\\\\" "((" <<EOF\nx\nEOF\nls',
      'echo ⟦string:"a\\\\"⟧ ⟦string:"(("⟧ ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls',
    ],
    [
      'bash',
      'echo "a" (( "b" <<EOF\nx\nEOF\nls',
      'echo ⟦string:"a"⟧ (( ⟦string:"b"⟧ ⟦keyword:<⟧⟦keyword:<⟧EOF\nx\nEOF\nls',
    ],
    // Quoted `((` is text, and a nested `$((a))` closes itself.
    [
      'bash',
      'echo "((" <<EOF\nx\nEOF\nls',
      'echo ⟦string:"(("⟧ ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls',
    ],
    [
      'bash',
      "echo '((' <<EOF\nx\nEOF\nls",
      "echo ⟦string:'(('⟧ ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls",
    ],
    [
      'bash',
      'echo $(( $((a)) << 2 ))\n2\nls',
      'echo $(( $((a)) ⟦keyword:<⟧⟦keyword:<⟧ 2 ))\n2\nls',
    ],
    // `<<` inside `((` shifts; after the arithmetic it opens a heredoc.
    [
      'bash',
      'echo $(( 1 << n ))\nn\nls',
      'echo $(( 1 ⟦keyword:<⟧⟦keyword:<⟧ n ))\nn\nls',
    ],
    [
      'bash',
      'echo $((1+2)) <<EOF\nx\nEOF\nls',
      'echo $((1+2)) ⟦keyword:<<⟧⟦string:EOF⟧\n⟦string:x\nEOF⟧\nls',
    ],
    // The `((` must be on the same line and within 200 characters, and a word
    // may be a number.
    [
      'bash',
      'echo "((a"\ncat <<E\nx\nE\nls',
      'echo ⟦string:"((a"⟧\ncat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:x\nE⟧\nls',
    ],
    [
      'bash',
      '((' + ' '.repeat(198) + '<<E\nx\nE\nls',
      '((' + ' '.repeat(198) + '⟦keyword:<⟧⟦keyword:<⟧E\nx\nE\nls',
    ],
    [
      'bash',
      '((' + ' '.repeat(199) + '<<E\nx\nE\nls',
      '((' + ' '.repeat(199) + '⟦keyword:<<⟧⟦string:E⟧\n⟦string:x\nE⟧\nls',
    ],
    [
      'bash',
      'echo $(( 1 << n ))\n' + 'k\n'.repeat(100) + 'n\n',
      'echo $(( 1 ⟦keyword:<⟧⟦keyword:<⟧ n ))\n' + 'k\n'.repeat(100) + 'n\n',
    ],
    [
      'bash',
      'cat << 3\nx\n3\nls',
      'cat ⟦keyword:<<⟧ ⟦string:3⟧\n⟦string:x\n3⟧\nls',
    ],
    [
      'bash',
      'cat <<a.b\nx\na.b\nls',
      'cat ⟦keyword:<<⟧⟦string:a.b⟧\n⟦string:x\na.b⟧\nls',
    ],
    [
      'bash',
      "cat <<'FOO-BAR'\nx\nFOO-BAR\nls",
      "cat ⟦keyword:<<⟧⟦string:'FOO-BAR'⟧\n⟦string:x\nFOO-BAR⟧\nls",
    ],
    // A word may hold `-` and `.`.
    [
      'bash',
      'cat <<FOO-BAR\nx\nFOO-BAR\nls',
      'cat ⟦keyword:<<⟧⟦string:FOO-BAR⟧\n⟦string:x\nFOO-BAR⟧\nls',
    ],
    [
      'bash',
      "cat <<'a.b'\nx\na.b\nls",
      "cat ⟦keyword:<<⟧⟦string:'a.b'⟧\n⟦string:x\na.b⟧\nls",
    ],
    ['bash', 'cat <<E\nx\nE', 'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:x\nE⟧'],
    // A word closes only the heredocs after it, and only as a line of its own.
    [
      'bash',
      'cat <<E\nx\nE\ncat <<E\ny\nE\ncat <<-E\n\tz\n\tE\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:x\nE⟧\ncat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:y\nE⟧\ncat ⟦keyword:<<-⟧⟦string:E⟧\n⟦string:\tz\n\tE⟧\nls',
    ],
    ['bash', 'E\ncat <<E\nx\nls', 'E\ncat ⟦keyword:<<⟧⟦string:E⟧\nx\nls'],
    [
      'bash',
      'cat <<E\nE x\nE\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:E x\nE⟧\nls',
    ],
    [
      'bash',
      'cat <<E\nE \nE\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:E \nE⟧\nls',
    ],
    [
      'bash',
      'cat <<-E\n  E\n\tE\nls',
      'cat ⟦keyword:<<-⟧⟦string:E⟧\n⟦string:  E\n\tE⟧\nls',
    ],
    [
      'bash',
      'cat <<E\r\nx\r\nE\r\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧\r\n⟦string:x\r\nE⟧\r\nls',
    ],
    [
      'bash',
      'x=$(cat <<E\nbody\nE\n)\nls',
      'x=$(cat ⟦keyword:<<⟧⟦string:E⟧\n⟦string:body\nE⟧\n)\nls',
    ],
    // A string that spans lines on the opener's line moves the body after it.
    [
      'bash',
      'cat <<E "a\nb"\nx\nE\nls',
      'cat ⟦keyword:<<⟧⟦string:E⟧ ⟦string:"a\nb"⟧\n⟦string:x\nE⟧\nls',
    ],
    // No closing line leaves the opener alone.
    [
      'bash',
      'cat <<E\nls -la',
      'cat ⟦keyword:<<⟧⟦string:E⟧\nls ⟦attr-name:-la⟧',
    ],
    // A here-string, a shift, and an opener in a comment or string are no
    // heredocs.
    [
      'bash',
      'cat <<< x\nx\nls',
      'cat ⟦keyword:<⟧⟦keyword:<⟧⟦keyword:<⟧ x\nx\nls',
    ],
    [
      'bash',
      'echo $((1 << 3))\n3\nls',
      'echo $((1 ⟦keyword:<⟧⟦keyword:<⟧ 3))\n3\nls',
    ],
    ['bash', '# <<E\nE\nls', '⟦comment:# <<E⟧\nE\nls'],
    ['bash', 'echo "<<E"\nE\nls', 'echo ⟦string:"<<E"⟧\nE\nls'],
  ];
  for (const [language, source, expected] of forms) {
    assert.equal(
      highlightCode(source, language),
      marked(expected),
      `${language}: ${source}`
    );
  }
});

test('closes a raw string at the last of a run of quotes', () => {
  assert.equal(
    highlightCode('f("""a"b""""); g("""c""")', 'kotlin'),
    `${t('function', 'f')}(${t('string', '"""a"b""""')}); ${t('function', 'g')}(${t('string', '"""c"""')})`
  );
});

test('lets a C# hole hold a char literal with a quote', () => {
  assert.equal(
    highlightCode('x = $"{(c == \'"\' ? "a" : "b")}" + 1;', 'csharp'),
    `x = $${t('string', '"{(c == \'"\' ? "a" : "b")}"')} + ${t('number', '1')};`
  );
});

test('highlights the same text the same way on every call', () => {
  // The first string scans fine; the scan of the second one fails.
  const source = 'x = "${f("a")}" + "${"';
  const expected = `x = ${t('string', '"${f("a")}"')} + ${t('string', '"${"')}`;
  assert.equal(highlightCode(source, 'kotlin'), expected);
  assert.equal(highlightCode(source, 'kotlin'), expected);
  assert.equal(highlightCode('"${"', 'groovy'), t('string', '"${"'));
  assert.equal(highlightCode(source, 'kotlin'), expected);
});

test('reads a nested string or hole by its own brackets', () => {
  // The paren of a Swift hole and the brace of a template hole nest.
  assert.equal(
    highlightCode('print("\\(f(x) ?? "a")")', 'swift'),
    `${t('function', 'print')}(${t('string', '"\\(f(x) ?? "a")"')})`
  );
  assert.equal(
    highlightCode("x = `${f({}) ? `a` : 'b'}`", 'typescript'),
    `x = ${t('string', "`${f({}) ? `a` : 'b'}`")}`
  );
});

test('reads a string flat when a hole holds a quote that starts no string and the outer quote follows', () => {
  // The stray ' pairs with a later one, so the scan fails and each string is
  // read flat.
  assert.equal(
    highlightCode(
      'a = `${s.replace(/\'/g, "")}`, b = `${t.replace(/\'/g, "")}`;',
      'typescript'
    ),
    `a = ${t('string', '`${s.replace(/\'/g, "")}`')}, b = ${t('string', '`${t.replace(/\'/g, "")}`')};`
  );
  assert.equal(
    highlightCode('val a = "${x /* it\'s */}" + \'}\' + "y"', 'kotlin'),
    `${t('keyword', 'val')} a = ${t('string', '"${x /* it\'s */}"')} + ${t('string', "'}'")} + ${t('string', '"y"')}`
  );
});

test('reads the rest of a line flat after a failed hole scan', () => {
  assert.equal(
    highlightCode('a = "${b /* it\'s */}" + "${f("x")}"', 'kotlin'),
    `a = ${t('string', '"${b /* it\'s */}"')} + ${t('string', '"${f("')}x${t('string', '")}"')}`
  );
});

test('keeps two plain C# strings with lone braces apart', () => {
  assert.equal(
    highlightCode('var a = "{", b = "}"; c = @"{", d = @"}";', 'csharp'),
    `${t('keyword', 'var')} a = ${t('string', '"{"')}, b = ${t('string', '"}"')}; c = ${t('string', '@"{"')}, d = ${t('string', '@"}"')};`
  );
  // {{ is text, so the first quote after it ends the string.
  assert.equal(
    highlightCode('f($"{{ "x" }}")', 'csharp'),
    `${t('function', 'f')}($${t('string', '"{{ "')}x${t('string', '" }}"')})`
  );
});

test('reads a brace in a plain C# string as text and {{ as a brace', () => {
  assert.equal(
    highlightCode('var s = "{"; var t = 1;', 'csharp'),
    `${t('keyword', 'var')} s = ${t('string', '"{"')}; ${t('keyword', 'var')} t = ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('var s = $"{{a}} {f("{")}"; var t = 1;', 'csharp'),
    `${t('keyword', 'var')} s = $${t('string', '"{{a}} {f("{")}"')}; ${t('keyword', 'var')} t = ${t('number', '1')};`
  );
});

test('scans the holes of the lines after a failed scan', () => {
  assert.equal(
    highlightCode('a = "${b /* it\'s */}"\nc = "${m["k"]}" + 1', 'kotlin'),
    `a = ${t('string', '"${b /* it\'s */}"')}\nc = ${t('string', '"${m["k"]}"')} + ${t('number', '1')}`
  );
  // A backslash before a line break escapes nothing, and a Swift hole ends at
  // its line.
  assert.equal(
    highlightCode('x = "\\(a\\\n)" + 1', 'swift'),
    `x = ${t('string', '"\\(a\\')}\n)${t('string', '" + 1')}`
  );
});

test('gives each string inside a hole the holes its language gives it', () => {
  // C#: {{ is text, so the string ends at its quote.
  assert.equal(
    highlightCode('f($"{{"); g();', 'csharp'),
    `${t('function', 'f')}($${t('string', '"{{"')}); ${t('function', 'g')}();`
  );
  // Kotlin: a string in a hole has holes, here around a '"' char.
  assert.equal(
    highlightCode('x = "${a("${\'"\'}")}" + 1', 'kotlin'),
    `x = ${t('string', '"${a("${\'"\'}")}"')} + ${t('number', '1')}`
  );
  // Dart: the same for a single-quoted string around a "'" string.
  assert.equal(
    highlightCode(`x = '\${a('\${"'"}')}' + 1`, 'dart'),
    `x = ${t('string', `'\${a('\${"'"}')}'`)} + ${t('number', '1')}`
  );
  // bash: a single-quoted string in a hole has none.
  assert.equal(
    highlightCode('echo "$(echo \'${\')" && ls', 'bash'),
    `echo ${t('string', '"$(echo \'${\')"')} ${t('keyword', '&amp;&amp;')} ls`
  );
});

test('reads a bash $( hole as shell code', () => {
  const cases = [
    // A backslash escapes a quote or a paren; a '…' string takes no escapes.
    ['echo "$(echo \\")" && ls', '"$(echo \\")"'],
    ['echo "$(echo \\()" && ls', '"$(echo \\()"'],
    ['echo "$(echo \'a\\\')" && ls', '"$(echo \'a\\\')"'],
    // A ')' inside a '…' string does not end the hole; parens nest.
    ['echo "$(echo \')"\')" && ls', '"$(echo \')"\')"'],
    ['echo "$(echo $((1 + 2)) "x")" && ls', '"$(echo $((1 + 2)) "x")"'],
    // Braces nest in a ${ hole.
    ['echo "${a:-${b}"x"}" && ls', '"${a:-${b}"x"}"'],
    // Each of these ends at another quote when read flat.
    ['echo "$(echo "$(echo ")")")" && ls', '"$(echo "$(echo ")")")"'],
    ['echo "$(echo \\" "x")" && ls', '"$(echo \\" "x")"'],
    ['echo "$(echo \'a\\\' "b")" && ls', '"$(echo \'a\\\' "b")"'],
    ['echo "$(echo \'${\' "x")" && ls', '"$(echo \'${\' "x")"'],
  ];
  for (const [source, string] of cases) {
    assert.equal(
      highlightCode(source, 'bash'),
      `echo ${t('string', string)} ${t('keyword', '&amp;&amp;')} ls`,
      source
    );
  }
});

test('ends a string with an open hole at the line', () => {
  assert.equal(
    highlightCode('x = "${a\nfoo()', 'kotlin'),
    `x = ${t('string', '"${a')}\n${t('function', 'foo')}()`
  );
  // The scan fails, so the string is read flat: up to the next quote.
  assert.equal(
    highlightCode('x = "${a "b\nfoo()', 'kotlin'),
    `x = ${t('string', '"${a "')}b\n${t('function', 'foo')}()`
  );
});

test('reads a string flat when its hole holds a quote that starts no string', () => {
  assert.equal(
    highlightCode("s = `${x.replace(/\"/g, '')}`; foo(1);", 'typescript'),
    `s = ${t('string', "`${x.replace(/\"/g, '')}`")}; ${t('function', 'foo')}(${t('number', '1')});`
  );
  assert.equal(
    highlightCode('x = "${/* it\'s */ y}" + 1', 'kotlin'),
    `x = ${t('string', '"${/* it\'s */ y}"')} + ${t('number', '1')}`
  );
});

test('lets a backslash keep a $ from opening a hole', () => {
  assert.equal(
    highlightCode('"\\${x" + y', 'kotlin'),
    `${t('string', '"\\${x"')} + y`
  );
});

test('reads holes like the recursive reading, also when unbalanced', () => {
  // A recursive reading of interpolated strings, to hold the scanner against. A
  // failure is ~i, for the position i where the reading gave up.
  function readStrings(source, { open, nest, close, quotes, multiline }) {
    // `outer` is the quote of the outermost string, and a string in a hole that
    // has seen the hole's end and then meets it was probably no string.
    const string = (from, quote, outer, inHole) => {
      let sawClose = false;
      for (let i = from; i < source.length; i++) {
        if (source[i] === '\n') return ~i;
        if (inHole) {
          if (source[i] === close) sawClose = true;
          else if (sawClose && source[i] === outer && source[i] !== quote) {
            return ~i;
          }
        }
        if (source.startsWith(open, i)) {
          const end = hole(i + open.length, outer);
          if (end < 0) return end;
          i = end - 1;
        } else if (source[i] === '\\' && source[i + 1] !== '\n') i++;
        else if (source[i] === quote) return i + 1;
      }
      return ~source.length;
    };
    const hole = (from, outer) => {
      let depth = 1;
      for (let i = from; i < source.length; i++) {
        if (source[i] === '\n') {
          if (!multiline) return ~i;
        } else if (source[i] === '\\' && source[i + 1] !== '\n') i++;
        else if (quotes.includes(source[i])) {
          const end = string(i + 1, source[i], outer, true);
          if (end < 0) return end;
          i = end - 1;
        } else if (source[i] === nest) depth++;
        else if (source[i] === close && --depth === 0) return i + 1;
      }
      return ~source.length;
    };
    const lineEnd = (from) => {
      const newline = source.indexOf('\n', from);
      return newline < 0 ? source.length : newline;
    };
    // The flat reading: up to the next quote.
    const flat = (from, quote) => {
      for (let i = from; i < source.length; i++) {
        if (source[i] === '\n') return i;
        if (source[i] === '\\' && source[i + 1] !== '\n') i++;
        else if (source[i] === quote) return i + 1;
      }
      return source.length;
    };
    let html = '';
    let failedUntil = -1;
    for (let i = 0; i < source.length; ) {
      // Outside a string a backslash escapes a quote.
      if (source[i] === '\\' && `"'`.includes(source[i + 1] ?? '\n')) {
        html += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (!quotes.includes(source[i])) {
        html += source[i++];
        continue;
      }
      let end = -1;
      if (i + 1 > failedUntil) {
        end = string(i + 1, source[i], source[i], false);
        if (end < 0) failedUntil = Math.max(~end, lineEnd(i + 1));
      }
      if (end < 0) end = flat(i + 1, source[i]);
      html += t('string', source.slice(i, end));
      i = end;
    }
    return html;
  }
  const next = random(11);
  const variants = [
    [
      'dart',
      { open: '${', nest: '{', close: '}', quotes: `"'`, multiline: true },
      ['"', "'", '${', '{', '}', '\\', 'x', ' ', '\n', '$'],
    ],
    [
      'swift',
      { open: '\\(', nest: '(', close: ')', quotes: '"' },
      ['"', '\\(', '(', ')', '\\', '.', ' ', '\n'],
    ],
  ];
  for (const [language, spec, pieces] of variants) {
    for (let i = 0; i < 4000; i++) {
      let source = '';
      for (let n = 1 + Math.floor(next() * 14); n > 0; n--) {
        source += pieces[Math.floor(next() * pieces.length)];
      }
      // Triple quotes are a separate rule.
      if (source.includes('"""') || source.includes("'''")) continue;
      assert.equal(
        highlightCode(source, language),
        readStrings(source, spec),
        `${language} ${JSON.stringify(source)}`
      );
    }
  }
});

test('closes a C# verbatim string at its quote and lets it span lines', () => {
  assert.equal(
    highlightCode('var p = @"C:\\dir\\" + x;', 'csharp'),
    `${t('keyword', 'var')} p = ${t('string', '@"C:\\dir\\"')} + x;`
  );
  assert.equal(
    highlightCode('var q = @"a\nb""c";', 'csharp'),
    `${t('keyword', 'var')} q = ${t('string', '@"a\nb""c"')};`
  );
  assert.equal(
    highlightCode('$@"{x}" + @$"{y}"', 'csharp'),
    `$${t('string', '@"{x}"')} + ${t('string', '@$"{y}"')}`
  );
  assert.equal(
    highlightCode('@"abc\nfoo()', 'csharp'),
    `${t('string', '@"abc')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('@"abc""\nfoo()', 'csharp'),
    `${t('string', '@"abc""')}\n${t('function', 'foo')}()`
  );
});

test('scans the holes of a C# interpolated verbatim string', () => {
  assert.equal(
    highlightCode('x = @$"C:\\{d["k"]}" + 1;', 'csharp'),
    `x = ${t('string', '@$"C:\\{d["k"]}"')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = @$"a{"b"}c" + 1;', 'csharp'),
    `x = ${t('string', '@$"a{"b"}c"')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = $@"a{"b"}c" + 1;', 'csharp'),
    `x = $${t('string', '@"a{"b"}c"')} + ${t('number', '1')};`
  );
  // A quote is written "" and a backslash is no escape.
  assert.equal(
    highlightCode('x = @$"say ""hi"" {y}\\" + 1;', 'csharp'),
    `x = ${t('string', '@$"say ""hi"" {y}\\"')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = @$"{{a}} {y}" + 1;', 'csharp'),
    `x = ${t('string', '@$"{{a}} {y}"')} + ${t('number', '1')};`
  );
  // Past its line it is read flat; unclosed, it ends at its line.
  assert.equal(
    highlightCode('x = $@"a\n{b}\nc" + 1;', 'csharp'),
    `x = $${t('string', '@"a\n{b}\nc"')} + ${t('number', '1')};`
  );
  assert.equal(
    highlightCode('x = @$"abc\nfoo();', 'csharp'),
    `x = ${t('string', '@$"abc')}\n${t('function', 'foo')}();`
  );
  // A doubled quote at the end does not close it.
  assert.equal(
    highlightCode('x = $@"a\n{b}\nc""\nfoo();', 'csharp'),
    `x = $${t('string', '@"a')}\n{b}\nc${t('string', '""')}\n${t('function', 'foo')}();`
  );
  // Without a $ the string has no holes.
  assert.equal(
    highlightCode('x = @"{"; y = 1;', 'csharp'),
    `x = ${t('string', '@"{"')}; y = ${t('number', '1')};`
  );
});

test('closes a Dart triple quote at its first three quotes', () => {
  assert.equal(
    highlightCode("x = \"a\" + '''b''''c'", 'dart'),
    `x = ${t('string', '"a"')} + ${t('string', "'''b'''")}${t('string', "'c'")}`
  );
  assert.equal(
    highlightCode("x = '''a''''b'", 'dart'),
    `x = ${t('string', "'''a'''")}${t('string', "'b'")}`
  );
  assert.equal(
    highlightCode("var s = r'abc\nfoo()", 'dart'),
    `${t('keyword', 'var')} s = ${t('string', "r'abc")}\n${t('function', 'foo')}()`
  );
});

test('closes a Dart raw string at its quote', () => {
  assert.equal(
    highlightCode("var p = r'C:\\dir\\';", 'dart'),
    `${t('keyword', 'var')} p = ${t('string', "r'C:\\dir\\'")};`
  );
  assert.equal(
    highlightCode("var q = r\"a\\\" + r'''b\n\\''';", 'dart'),
    `${t('keyword', 'var')} q = ${t('string', 'r"a\\"')} + ${t('string', "r'''b\n\\'''")};`
  );
  assert.equal(highlightCode("bar'x'", 'dart'), `bar${t('string', "'x'")}`);
});

test('closes a Swift raw string at a quote with the same number of hashes', () => {
  assert.equal(
    highlightCode('let s = #"say "hi""# + x', 'swift'),
    `${t('keyword', 'let')} s = ${t('string', '#"say "hi""#')} + x`
  );
  assert.equal(
    highlightCode('x(#"a"#, #"b"#)', 'swift'),
    `${t('function', 'x')}(${t('string', '#"a"#')}, ${t('string', '#"b"#')})`
  );
  assert.equal(
    highlightCode('let s = ##"a"#b"##', 'swift'),
    `${t('keyword', 'let')} s = ${t('string', '##"a"#b"##')}`
  );
  assert.equal(
    highlightCode('let s = #"abc\nfoo()', 'swift'),
    `${t('keyword', 'let')} s = ${t('string', '#"abc')}\n${t('function', 'foo')}()`
  );
  assert.equal(
    highlightCode('let m = #"""\nx\n"""#', 'swift'),
    `${t('keyword', 'let')} m = #${t('string', '"""\nx\n"""')}#`
  );
  assert.equal(
    highlightCode('let h = "#"', 'swift'),
    `${t('keyword', 'let')} h = ${t('string', '"#"')}`
  );
});

test('colors an empty or unclosed form as the token it is', () => {
  const forms = [
    // A lone `#` is an empty comment.
    ['bash', '#', '⟦comment:#⟧'],
    ['yaml', '#', '⟦comment:#⟧'],
    ['gdscript', '#', '⟦comment:#⟧'],
    ['toml', '#', '⟦comment:#⟧'],
    ['graphql', '#', '⟦comment:#⟧'],
    ['properties', '#', '⟦comment:#⟧'],
    // An empty string ends at once; a lone quote runs to the end of the line.
    ['typescript', "f('', 1)", "⟦function:f⟧(⟦string:''⟧, ⟦number:1⟧)"],
    ['typescript', "f('abc", "⟦function:f⟧(⟦string:'abc⟧"],
    ['typescript', "'", "⟦string:'⟧"],
    ['gdscript', 'f("", 1)', '⟦function:f⟧(⟦string:""⟧, ⟦number:1⟧)'],
    ['gdscript', "f('', 1)", "⟦function:f⟧(⟦string:''⟧, ⟦number:1⟧)"],
    ['gdscript', '"', '⟦string:"⟧'],
    ['gdscript', "'", "⟦string:'⟧"],
    ['json', '{"": 1}', '{⟦attr-name:""⟧: ⟦number:1⟧}'],
    ['csharp', 'f(@"", 1)', '⟦function:f⟧(⟦string:@""⟧, ⟦number:1⟧)'],
    ['csharp', '@"', '⟦string:@"⟧'],
    // A template or C# string whose hole scan failed leaves a later empty one
    // on the line alone.
    [
      'typescript',
      'const a = `${"}`; const b = ``; const c = 1;',
      '⟦keyword:const⟧ a = ⟦string:`${"}`⟧; ⟦keyword:const⟧ b = ⟦string:``⟧; ⟦keyword:const⟧ c = ⟦number:1⟧;',
    ],
    [
      'csharp',
      `var a = @$"{x /* it's */}"; var b = @$""; var c = 1;`,
      `⟦keyword:var⟧ a = ⟦string:@$"{x /* it's */}"⟧; ⟦keyword:var⟧ b = ⟦string:@$""⟧; ⟦keyword:var⟧ c = ⟦number:1⟧;`,
    ],
    // Single quotes that are empty or unclosed, and a lone shebang.
    ['kotlin', "val c = ''", "⟦keyword:val⟧ c = ⟦string:''⟧"],
    [
      'kotlin',
      "val c = 'a'; val d = '; f(1)",
      "⟦keyword:val⟧ c = ⟦string:'a'⟧; ⟦keyword:val⟧ d = ⟦string:'; f(1)⟧",
    ],
    ['csharp', "char c = '", "⟦keyword:char⟧ c = ⟦string:'⟧"],
    ['yaml', "a: ''", "⟦attr-name:a⟧: ⟦string:''⟧"],
    ['yaml', "a: 'x", "⟦attr-name:a⟧: ⟦string:'x⟧"],
    ['yaml', "a: '", "⟦attr-name:a⟧: ⟦string:'⟧"],
    ['toml', "a = ''", "⟦attr-name:a⟧ = ⟦string:''⟧"],
    ['toml', "a = 'x", "⟦attr-name:a⟧ = ⟦string:'x⟧"],
    ['toml', "a = '", "⟦attr-name:a⟧ = ⟦string:'⟧"],
    ['bash', "echo '' ls", "echo ⟦string:''⟧ ls"],
    ['bash', "echo $'' ls", "echo ⟦string:$''⟧ ls"],
    ['bash', "echo $'a ls", "echo ⟦string:$'a ls⟧"],
    ['bash', 'cat <<"" x\nls', 'cat ⟦keyword:<⟧⟦keyword:<⟧⟦string:""⟧ x\nls'],
    ['typescript', '#!', '⟦comment:#!⟧'],
    // C# raw strings take no escapes and may span lines.
    [
      'csharp',
      'var s = """\n  {"a": 1}\n  """; f(1);',
      '⟦keyword:var⟧ s = ⟦string:"""\n  {"a": 1}\n  """⟧; ⟦function:f⟧(⟦number:1⟧);',
    ],
    [
      'csharp',
      'var s = """abc\nf(1);',
      '⟦keyword:var⟧ s = ⟦string:"""abc⟧\n⟦function:f⟧(⟦number:1⟧);',
    ],
    // Triple quotes: empty, two on a line, and unclosed.
    ['dart', 'f("""""", 1)', '⟦function:f⟧(⟦string:""""""⟧, ⟦number:1⟧)'],
    ['dart', "f('''''', 1)", "⟦function:f⟧(⟦string:''''''⟧, ⟦number:1⟧)"],
    [
      'dart',
      'f("""a""", """b""")',
      '⟦function:f⟧(⟦string:"""a"""⟧, ⟦string:"""b"""⟧)',
    ],
    [
      'dart',
      "f('''a''', '''b''')",
      "⟦function:f⟧(⟦string:'''a'''⟧, ⟦string:'''b'''⟧)",
    ],
    ['swift', '"""', '⟦string:"""⟧'],
    [
      'kotlin',
      'f("""""", """a""")',
      '⟦function:f⟧(⟦string:""""""⟧, ⟦string:"""a"""⟧)',
    ],
    ['dart', "'''", "⟦string:'''⟧"],
    // Dart raw strings, the same ways.
    ['dart', 'f(r\'\', r"")', '⟦function:f⟧(⟦string:r\'\'⟧, ⟦string:r""⟧)'],
    ['dart', "f(r'''''', 1)", "⟦function:f⟧(⟦string:r''''''⟧, ⟦number:1⟧)"],
    ['dart', 'f(r"""""", 1)', '⟦function:f⟧(⟦string:r""""""⟧, ⟦number:1⟧)'],
    [
      'dart',
      "f(r'''a''', r'''b''')",
      "⟦function:f⟧(⟦string:r'''a'''⟧, ⟦string:r'''b'''⟧)",
    ],
    [
      'dart',
      'f(r"""a""", r"""b""")',
      '⟦function:f⟧(⟦string:r"""a"""⟧, ⟦string:r"""b"""⟧)',
    ],
    ['dart', "r'", "⟦string:r'⟧"],
    ['dart', 'r"', '⟦string:r"⟧'],
    ['dart', "r'abc", "⟦string:r'abc⟧"],
    ['dart', 'r"abc', '⟦string:r"abc⟧'],
    ['dart', "r'''", "⟦string:r'''⟧"],
    ['dart', 'r"""', '⟦string:r"""⟧'],
    // Swift raw strings: empty, unclosed, and a `#"""` opener that stays a
    // triple quote even with `"#` after it on the line.
    ['swift', 'f(#""#, 1)', '⟦function:f⟧(⟦string:#""#⟧, ⟦number:1⟧)'],
    ['swift', '#"', '⟦string:#"⟧'],
    ['swift', '#"""a"""#', '#⟦string:"""a"""⟧#'],
    // A one-letter annotation or directive is still one.
    ['swift', '@a', '⟦decorator:@a⟧'],
    ['kotlin', '@a', '⟦decorator:@a⟧'],
    ['csharp', '#r "x"', '⟦keyword:#r⟧ ⟦string:"x"⟧'],
    ['csharp', '@a(1)', '@a(⟦number:1⟧)'],
    ['csharp', '@params(1)', '@params(⟦number:1⟧)'],
    // Bash: a command needs a word boundary; one-letter variables and flags.
    ['bash', 'rmdir build', 'rmdir build'],
    ['bash', 'echo $a', 'echo ⟦variable:$a⟧'],
    ['bash', 'ls -a', 'ls ⟦attr-name:-a⟧'],
    ['bash', 'echo ${} ${', 'echo ${} ${'],
    // TOML: a multi-line string closes at the last quote of a run, takes its
    // own backslash escapes, and does not run on into the next one.
    ['toml', 'a = """', '⟦attr-name:a⟧ = ⟦string:"""⟧'],
    ['toml', 'a = """""" # c', '⟦attr-name:a⟧ = ⟦string:""""""⟧ ⟦comment:# c⟧'],
    ['toml', "a = '''''' # c", "⟦attr-name:a⟧ = ⟦string:''''''⟧ ⟦comment:# c⟧"],
    [
      'toml',
      'a = """x"""" # c',
      '⟦attr-name:a⟧ = ⟦string:"""x""""⟧ ⟦comment:# c⟧',
    ],
    ['toml', 'a = """x\\""" b', '⟦attr-name:a⟧ = ⟦string:"""x\\""" b⟧'],
    [
      'toml',
      'a = """x"""\nb = 1\nc = """y"""',
      '⟦attr-name:a⟧ = ⟦string:"""x"""⟧\n⟦attr-name:b⟧ = ⟦number:1⟧\n⟦attr-name:c⟧ = ⟦string:"""y"""⟧',
    ],
    ['toml', "a = '''", "⟦attr-name:a⟧ = ⟦string:'''⟧"],
    [
      'toml',
      "a = '''x\nb = 1",
      "⟦attr-name:a⟧ = ⟦string:'''x⟧\n⟦attr-name:b⟧ = ⟦number:1⟧",
    ],
    [
      'toml',
      "a = '''x'''\nb = 1\nc = '''y'''",
      "⟦attr-name:a⟧ = ⟦string:'''x'''⟧\n⟦attr-name:b⟧ = ⟦number:1⟧\n⟦attr-name:c⟧ = ⟦string:'''y'''⟧",
    ],
    ['toml', '[]', '⟦keyword:[]⟧'],
    ['toml', '[', '['],
    // GraphQL: block strings, enum values at any indent, a type after a colon
    // with no space, an alias, and a word that is no keyword.
    ['graphql', 'a(b: """""")', 'a(⟦field:b⟧⟦punctuation::⟧ ⟦string:""""""⟧)'],
    ['graphql', '"""a""" """b"""', '⟦string:"""a"""⟧ ⟦string:"""b"""⟧'],
    ['graphql', '"""', '⟦string:"""⟧'],
    ['graphql', 'RED', '⟦enum-value:RED⟧'],
    ['graphql', 'A', '⟦enum-value:A⟧'],
    ['graphql', '  RED # c', '  ⟦enum-value:RED⟧ ⟦comment:# c⟧'],
    ['graphql', 'A #', '⟦enum-value:A⟧ ⟦comment:#⟧'],
    [
      'graphql',
      'query($a: Int)',
      '⟦keyword:query⟧($a⟦punctuation::⟧ ⟦builtin-type:Int⟧)',
    ],
    ['graphql', 'extendtype Foo', 'extendtype Foo'],
    ['graphql', 'name:Int', '⟦field:name⟧⟦punctuation::⟧⟦builtin-type:Int⟧'],
    ['graphql', 'x: a { b }', '⟦field:x⟧⟦punctuation::⟧ a { b }'],
    // XML: an empty attribute value.
    [
      'xml',
      `<a b="" c=''/>`,
      `⟦punctuation:<⟧⟦tag:a⟧ ⟦attr-name:b⟧=⟦attr-value:""⟧ ⟦attr-name:c⟧=⟦attr-value:''⟧⟦punctuation:/>⟧`,
    ],
  ];
  for (const [language, source, expected] of forms) {
    assert.equal(
      highlightCode(source, language),
      marked(expected),
      `${language}: ${source}`
    );
  }
});

test('reads line ends, names and separators the way each rule defines them', () => {
  const forms = [
    // A quoted string ends at its line, also after a backslash; only
    // TypeScript, JavaScript and Groovy go on to the next line. Bash strings
    // hold line breaks.
    ['typescript', 'x = "a\nb"', 'x = ⟦string:"a⟧\nb⟦string:"⟧'],
    ['typescript', 'x = "a\\\nb"', 'x = ⟦string:"a\\\nb"⟧'],
    ['typescript', "x = 'a\nb'", "x = ⟦string:'a⟧\nb'"],
    ['typescript', "x = 'a\\\nb'", "x = ⟦string:'a\\\nb'⟧"],
    ['bash', "echo 'a\nb'", "echo ⟦string:'a\nb'⟧"],
    ['bash', 'echo "a\nb"', 'echo ⟦string:"a\nb"⟧'],
    ['bash', "echo 'a\\\nb'", "echo ⟦string:'a\\\nb'⟧"],
    ['bash', 'echo "a\\\nb"', 'echo ⟦string:"a\\\nb"⟧'],
    ['csharp', "char c = 'x';", "⟦keyword:char⟧ c = ⟦string:'x'⟧;"],
    ['swift', "let r = /it's/", "⟦keyword:let⟧ r = /it's/"],
    ['groovy', "def s = 'a'", "⟦keyword:def⟧ s = ⟦string:'a'⟧"],
    ['groovy', 'def t = """a\nb"""', '⟦keyword:def⟧ t = ⟦string:"""a\nb"""⟧'],
    ['groovy', 'println(x)', '⟦function:println⟧(x)'],
    ['json', '{"a\n": 1}', '{⟦string:"a⟧\n⟦string:": 1}⟧'],
    ['json', '{"a\\\n": 1}', '{⟦string:"a⟧\\\n⟦string:": 1}⟧'],
    ['json', '{"a\\"b": 1}', '{⟦attr-name:"a\\"b"⟧: ⟦number:1⟧}'],
    ['json', '{"a"\t: 1}', '{⟦attr-name:"a"⟧\t: ⟦number:1⟧}'],
    ['json', '{"a\\": 1}', '{⟦string:"a\\": 1}⟧'],
    ['dart', 'r"a\nb"', '⟦string:r"a⟧\nb⟦string:"⟧'],
    ['dart', "r'a\nb'", "⟦string:r'a⟧\nb⟦string:'⟧"],
    ['swift', '#"a\nb"#', '⟦string:#"a⟧\nb⟦string:"#⟧'],
    // GDScript strings hold line breaks and take backslash escapes.
    ['gdscript', 'f("a", "b")', '⟦function:f⟧(⟦string:"a"⟧, ⟦string:"b"⟧)'],
    ['gdscript', "f('a', 'b')", "⟦function:f⟧(⟦string:'a'⟧, ⟦string:'b'⟧)"],
    ['gdscript', "x = 'it\\'s'", "x = ⟦string:'it\\'s'⟧"],
    ['gdscript', "x = 'a\\\nb'", "x = ⟦string:'a\\\nb'⟧"],
    // A template closes at an unescaped backtick, also on a later line.
    [
      'typescript',
      'x = `a\\`\nb`; y = 1',
      'x = ⟦string:`a\\`\nb`⟧; y = ⟦number:1⟧',
    ],
    // A nested string holding the hole's closer or opener, then the outer
    // quote, or another kind of quote, still closes with the outer one.
    ['kotlin', `x = "\${f("}'")}"`, `x = ⟦string:"\${f("}'")}"⟧`],
    ['kotlin', 'x = "${f("")}" + 1', 'x = ⟦string:"${f("")}"⟧ + ⟦number:1⟧'],
    ['csharp', '$"{f("a")}" + x', '$⟦string:"{f("a")}"⟧ + x'],
    ['typescript', 'x = `${f(")`")}`', 'x = ⟦string:`${f(")`")}`⟧'],
    ['typescript', 'x = `${f("{`")}`', 'x = ⟦string:`${f("{`")}`⟧'],
    // A plain string in a template hole has no holes of its own.
    [
      'typescript',
      'x = `${a + `` + "${"}`; y = 1',
      'x = ⟦string:`${a + `` + "${"}`⟧; y = ⟦number:1⟧',
    ],
    [
      'typescript',
      "x = `${a + `` + '${'}`; y = 1",
      "x = ⟦string:`${a + `` + '${'}`⟧; y = ⟦number:1⟧",
    ],
    // Brackets nest inside a hole, and a string in a hole takes its language's holes.
    [
      'kotlin',
      'val s = "${run { 1 } + "x"}" + 1',
      '⟦keyword:val⟧ s = ⟦string:"${run { 1 } + "x"}"⟧ + ⟦number:1⟧',
    ],
    [
      'dart',
      'x = "${f("${g("a")}")}" + 1',
      'x = ⟦string:"${f("${g("a")}")}"⟧ + ⟦number:1⟧',
    ],
    [
      'dart',
      'x = "${f("${g("}")}")}" + 1',
      'x = ⟦string:"${f("${g("}")}")}"⟧ + ⟦number:1⟧',
    ],
    [
      'swift',
      'x = "\\(f("\\(g("a"))"))" + 1',
      'x = ⟦string:"\\(f("\\(g("a"))"))"⟧ + ⟦number:1⟧',
    ],
    [
      'swift',
      'x = "\\(f(1) + "x")" + 1',
      'x = ⟦string:"\\(f(1) + "x")"⟧ + ⟦number:1⟧',
    ],
    ['bash', 'echo "$(f "a\\"b")" y', 'echo ⟦string:"$(f "a\\"b")"⟧ y'],
    // Multi-line triple, raw and TOML strings; an unclosed one stops at its line.
    ['dart', "f('''a\nb''')", "⟦function:f⟧(⟦string:'''a\nb'''⟧)"],
    ['dart', 'f(r"""a\nb""")', '⟦function:f⟧(⟦string:r"""a\nb"""⟧)'],
    ['dart', "r'''a\nf()", "⟦string:r'''a⟧\n⟦function:f⟧()"],
    ['dart', 'r"""a\nf()', '⟦string:r"""a⟧\n⟦function:f⟧()'],
    ['dart', "r'''abc", "⟦string:r'''abc⟧"],
    ['dart', 'r"""abc', '⟦string:r"""abc⟧'],
    ['kotlin', 'f("""a\nb"""")', '⟦function:f⟧(⟦string:"""a\nb""""⟧)'],
    [
      'toml',
      'a = """x \\\n  y""" # c',
      '⟦attr-name:a⟧ = ⟦string:"""x \\\n  y"""⟧ ⟦comment:# c⟧',
    ],
    [
      'toml',
      "a = '''x\ny''' # c",
      "⟦attr-name:a⟧ = ⟦string:'''x\ny'''⟧ ⟦comment:# c⟧",
    ],
    [
      'toml',
      "a = '''C:\\''' # c",
      "⟦attr-name:a⟧ = ⟦string:'''C:\\'''⟧ ⟦comment:# c⟧",
    ],
    [
      'toml',
      'a = """x\nb = 1',
      '⟦attr-name:a⟧ = ⟦string:"""x⟧\n⟦attr-name:b⟧ = ⟦number:1⟧',
    ],
    // Names take capitals, digits, underscores and, where the language does,
    // dots and dashes.
    ['typescript', '_a1B_\t(x)', '⟦function:_a1B_⟧\t(x)'],
    [
      'typescript',
      'await initConnection(); newValue willAutoRenew',
      '⟦keyword:await⟧ ⟦function:initConnection⟧(); newValue willAutoRenew',
    ],
    [
      'typescript',
      'X.EXTERNAL_OFFER',
      '⟦class-name:X⟧.⟦class-name:EXTERNAL_OFFER⟧',
    ],
    [
      'kotlin',
      'val m: Map<Foo, Bar>',
      '⟦keyword:val⟧ m: ⟦class-name:Map⟧<⟦class-name:Foo⟧, ⟦class-name:Bar⟧>',
    ],
    ['kotlin', '@Composable', '⟦decorator:@Composable⟧'],
    [
      'swift',
      '@_exported import X',
      '⟦decorator:@_exported⟧ ⟦keyword:import⟧ ⟦class-name:X⟧',
    ],
    ['csharp', '@Event', '@Event'],
    ['kotlin', 'x@Label', 'x@⟦class-name:Label⟧'],
    ['csharp', '@_x(1)', '@_x(⟦number:1⟧)'],
    ['bash', 'echo $_a $A_b9', 'echo ⟦variable:$_a⟧ ⟦variable:$A_b9⟧'],
    [
      'bash',
      'npm i -D --save-dev',
      '⟦function:npm⟧ i ⟦attr-name:-D⟧ ⟦attr-name:--save-dev⟧',
    ],
    ['yaml', 'Key_1.sub-x\t: v', '⟦attr-name:Key_1.sub-x⟧\t: v'],
    ['toml', 'Key_1.sub-x = 1', '⟦attr-name:Key_1.sub-x⟧ = ⟦number:1⟧'],
    ['toml', 'name    = "x"', '⟦attr-name:name⟧    = ⟦string:"x"⟧'],
    ['yaml', '_id: 1', '⟦attr-name:_id⟧: ⟦number:1⟧'],
    ['yaml', '200: OK', '⟦attr-name:200⟧: OK'],
    // A YAML `:` needs a space or the line end after it.
    ['yaml', '12:30', '⟦number:12⟧:⟦number:30⟧'],
    ['yaml', 'http://x.dev', 'http://x.dev'],
    ['yaml', 'key:', '⟦attr-name:key⟧:'],
    ['yaml', 'a\n: 1', 'a\n: ⟦number:1⟧'],
    ['yaml', 'k:\tv', '⟦attr-name:k⟧:\tv'],
    [
      'yaml',
      'key:\r\nnext: 1',
      '⟦attr-name:key⟧:\r\n⟦attr-name:next⟧: ⟦number:1⟧',
    ],
    ['toml', '1234 = "v"', '⟦attr-name:1234⟧ = ⟦string:"v"⟧'],
    ['toml', 'a- = 1', '⟦attr-name:a-⟧ = ⟦number:1⟧'],
    ['yaml', '  a : 1', '  ⟦attr-name:a⟧ : ⟦number:1⟧'],
    ['toml', ' a\t= 1', ' ⟦attr-name:a⟧\t= ⟦number:1⟧'],
    ['yaml', 'true: 1', '⟦attr-name:true⟧: ⟦number:1⟧'],
    ['toml', 'true = 1', '⟦attr-name:true⟧ = ⟦number:1⟧'],
    ['yaml', 'VERSION=$(jq -r .v p.json)', 'VERSION=$(jq -r .v p.json)'],
    ['toml', 'a: 1', 'a: ⟦number:1⟧'],
    // An apostrophe after a word is text, also after a number or a keyword.
    ['yaml', "msg: I'm here", "⟦attr-name:msg⟧: I'm here"],
    ['yaml', "name: O'Brien", "⟦attr-name:name⟧: O'Brien"],
    ['yaml', "note: 1990's music", "⟦attr-name:note⟧: ⟦number:1990⟧'s music"],
    ['yaml', "ok: true's", "⟦attr-name:ok⟧: ⟦keyword:true⟧'s"],
    // A quote after a bracket still opens a string.
    ['yaml', "run: f('a b')", "⟦attr-name:run⟧: f(⟦string:'a b'⟧)"],
    ['toml', '_id = 1', '⟦attr-name:_id⟧ = ⟦number:1⟧'],
    [
      'graphql',
      '  _id\t: ID',
      '  ⟦field:_id⟧\t⟦punctuation::⟧ ⟦builtin-type:ID⟧',
    ],
    [
      'graphql',
      'query($Id: ID, $_x: Int)',
      '⟦keyword:query⟧($Id⟦punctuation::⟧ ⟦builtin-type:ID⟧, $_x⟦punctuation::⟧ ⟦builtin-type:Int⟧)',
    ],
    [
      'graphql',
      'x: my_type!',
      '⟦field:x⟧⟦punctuation::⟧ ⟦custom-type:my_type⟧⟦required:!⟧',
    ],
    [
      'graphql',
      'x: Foo_1\t(y: 1)',
      '⟦field:x⟧⟦punctuation::⟧ Foo_1\t(⟦field:y⟧⟦punctuation::⟧ 1)',
    ],
    ['graphql', 'x: a\t{ b }', '⟦field:x⟧⟦punctuation::⟧ a\t{ b }'],
    [
      'graphql',
      'x: __Schema!',
      '⟦field:x⟧⟦punctuation::⟧ ⟦custom-type:__Schema⟧⟦required:!⟧',
    ],
    ['graphql', 'x: _a { b }', '⟦field:x⟧⟦punctuation::⟧ _a { b }'],
    [
      'xml',
      '<a _b.c-d="1" e:f="2"/>',
      '⟦punctuation:<⟧⟦tag:a⟧ ⟦attr-name:_b.c-d⟧=⟦attr-value:"1"⟧ ⟦attr-name:e:f⟧=⟦attr-value:"2"⟧⟦punctuation:/>⟧',
    ],
    ['xml', '<_a.b:c-d/>', '⟦punctuation:<⟧⟦tag:_a.b:c-d⟧⟦punctuation:/>⟧'],
    [
      'xml',
      '<a 1.b="x" 2-c="y">',
      '⟦punctuation:<⟧⟦tag:a⟧ 1.b="x" 2-c="y"⟦punctuation:>⟧',
    ],
    // A tab or a space indents any line-start rule.
    ['bash', ' cd build', ' ⟦function:cd⟧ build'],
    ['bash', '\tcd build', '\t⟦function:cd⟧ build'],
    ['yaml', ' a: 1', ' ⟦attr-name:a⟧: ⟦number:1⟧'],
    ['toml', '\ta = 1', '\t⟦attr-name:a⟧ = ⟦number:1⟧'],
    ['toml', '\t[table]', '\t⟦keyword:[table]⟧'],
    ['csharp', '\t#endif', '\t⟦keyword:#endif⟧'],
    ['properties', ' # c', ' ⟦comment:# c⟧'],
    ['properties', '\t! c', '\t⟦comment:! c⟧'],
    ['properties', '  a=1', '  ⟦attr-name:a⟧=⟦string:1⟧'],
    ['properties', '\ta\t=\tb', '\t⟦attr-name:a⟧\t=\t⟦string:b⟧'],
    [
      'graphql',
      'enum Color {\n\tRED\n  _HIDDEN\t\n}',
      '⟦keyword:enum⟧ ⟦type-name:Color⟧ {\n\t⟦enum-value:RED⟧\n  ⟦enum-value:_HIDDEN⟧\t\n}',
    ],
    ['graphql', 'type\tQuery {', '⟦keyword:type⟧\t⟦type-name:Query⟧ {'],
    [
      'graphql',
      'extend\ttype Query',
      '⟦keyword:extend\ttype⟧ ⟦type-name:Query⟧',
    ],
    [
      'graphql',
      'name:\tInt',
      '⟦field:name⟧⟦punctuation::⟧\t⟦builtin-type:Int⟧',
    ],
    // A TOML header and a properties line end at the line; a value keeps `=`.
    ['toml', '[a\nb]', '[a\nb]'],
    ['toml', '[table] # note]', '⟦keyword:[table]⟧ ⟦comment:# note]⟧'],
    ['properties', 'a=b=c', '⟦attr-name:a⟧=⟦string:b=c⟧'],
    ['properties', 'a==b', '⟦attr-name:a⟧=⟦string:=b⟧'],
    ['properties', '# a=b', '⟦comment:# a=b⟧'],
    ['properties', '! a=b', '⟦comment:! a=b⟧'],
    ['properties', 'a\rb=2', 'a\r⟦attr-name:b⟧=⟦string:2⟧'],
    ['properties', 'a\r=1', 'a\r=1'],
    ['properties', 'a\n=1', 'a\n=1'],
    [
      'properties',
      'a=1\r\nb=2',
      '⟦attr-name:a⟧=⟦string:1⟧\r\n⟦attr-name:b⟧=⟦string:2⟧',
    ],
    ['properties', 'a\nb=2', 'a\n⟦attr-name:b⟧=⟦string:2⟧'],
    ['properties', 'a=\nb=2', '⟦attr-name:a⟧=\n⟦attr-name:b⟧=⟦string:2⟧'],
    ['properties', '=value', '=value'],
    ['properties', '=a=b', '=a=b'],
    // An XML value may hold a line break; a lone quote leaves the tag as text.
    [
      'xml',
      '<a b="x\ny"/>',
      '⟦punctuation:<⟧⟦tag:a⟧ ⟦attr-name:b⟧=⟦attr-value:"x\ny"⟧⟦punctuation:/>⟧',
    ],
    [
      'xml',
      "<a b='x\ny'/>",
      "⟦punctuation:<⟧⟦tag:a⟧ ⟦attr-name:b⟧=⟦attr-value:'x\ny'⟧⟦punctuation:/>⟧",
    ],
    ['xml', "<a b='c>text", "<a b='c>text"],
  ];
  for (const [language, source, expected] of forms) {
    assert.equal(
      highlightCode(source, language),
      marked(expected),
      `${language}: ${source}`
    );
  }
});

test('reads the forms that need their context', () => {
  const forms = [
    // A backtick name may hold a quote or a keyword; Swift also has `if`.
    [
      'kotlin',
      "fun `purchase isn't ok`() {}",
      "⟦keyword:fun⟧ `purchase isn't ok`() {}",
    ],
    ['kotlin', 'val `class` = 1', '⟦keyword:val⟧ `class` = ⟦number:1⟧'],
    [
      'swift',
      'func `default`(_ `if`: Int) {}',
      '⟦keyword:func⟧ `default`(_ `if`: ⟦class-name:Int⟧) {}',
    ],
    // A Swift `#name` is a keyword anywhere, not only at a line start.
    [
      'swift',
      'if #available(iOS 15, *) { print(#function) }',
      '⟦keyword:if⟧ ⟦keyword:#available⟧(iOS ⟦number:15⟧, *) { ⟦function:print⟧(⟦keyword:#function⟧) }',
    ],
    [
      'swift',
      'x = #selector(Foo.bar) + #colorLiteral(red: 1, alpha: 1)',
      'x = ⟦keyword:#selector⟧(⟦class-name:Foo⟧.bar) + ⟦keyword:#colorLiteral⟧(red: ⟦number:1⟧, alpha: ⟦number:1⟧)',
    ],
    [
      'swift',
      'let e = try #require(value)',
      '⟦keyword:let⟧ e = ⟦keyword:try⟧ ⟦keyword:#require⟧(value)',
    ],
    ['swift', 'a#b', 'a#b'],
    [
      'swift',
      'let k = \\Person.name',
      '⟦keyword:let⟧ k = \\⟦class-name:Person⟧.name',
    ],
    // `$` belongs to a name: `Schema$Order` is one type, `$Foo` none.
    [
      'typescript',
      'type T = Schema$Order; const el = $Foo; Foo$Bar.x',
      '⟦keyword:type⟧ ⟦class-name:T⟧ = ⟦class-name:Schema$Order⟧; ⟦keyword:const⟧ el = $Foo; ⟦class-name:Foo$Bar⟧.x',
    ],
    // A node path is plain from the `$` to its last name.
    [
      'gdscript',
      '@onready var p = $Player/Sprite2D',
      '⟦decorator:@onready⟧ ⟦keyword:var⟧ p = $Player/Sprite2D',
    ],
    [
      'gdscript',
      '$A/B.f(1); $"A B/C".g; Label.new()',
      '$A/B.⟦function:f⟧(⟦number:1⟧); $⟦string:"A B/C"⟧.g; ⟦class-name:Label⟧.⟦function:new⟧()',
    ],
    // A YAML list item is indentation: its key is a key.
    ['yaml', '- name: x', '- ⟦attr-name:name⟧: x'],
    ['yaml', '  - uses: a/b@v4', '  - ⟦attr-name:uses⟧: a/b@v4'],
    ['yaml', '- - a: 1', '- - ⟦attr-name:a⟧: ⟦number:1⟧'],
    ['yaml', '- 200: OK', '- ⟦attr-name:200⟧: OK'],
    ['yaml', '-name: y', '-name: y'],
    ['yaml', '- http://x', '- http://x'],
    ['yaml', '- run: |', '- ⟦attr-name:run⟧: |'],
    // Bash `$'…'` takes backslash escapes.
    [
      'bash',
      "IFS=$'\\n' x=$'it\\'s' y='a'",
      "IFS=⟦string:$'\\n'⟧ x=⟦string:$'it\\'s'⟧ y=⟦string:'a'⟧",
    ],
    // Swift, Dart, Groovy and GDScript triple quotes take backslash escapes;
    // Kotlin and C# raw strings do not.
    [
      'swift',
      'let s = """\nA \\"""B\nC\n""" + x',
      '⟦keyword:let⟧ s = ⟦string:"""\nA \\"""B\nC\n"""⟧ + x',
    ],
    [
      'dart',
      "var s = '''a\\'''b''' + x;",
      "⟦keyword:var⟧ s = ⟦string:'''a\\'''b'''⟧ + x;",
    ],
    [
      'groovy',
      'def s = """a\\"""b""" + x',
      '⟦keyword:def⟧ s = ⟦string:"""a\\"""b"""⟧ + x',
    ],
    [
      'gdscript',
      'var s = """a\\"""b""" + x',
      '⟦keyword:var⟧ s = ⟦string:"""a\\"""b"""⟧ + x',
    ],
    [
      'kotlin',
      'f("""C:\\""", 1)',
      '⟦function:f⟧(⟦string:"""C:\\"""⟧, ⟦number:1⟧)',
    ],
    [
      'csharp',
      'var s = """C:\\"""; var t = 1;',
      '⟦keyword:var⟧ s = ⟦string:"""C:\\"""⟧; ⟦keyword:var⟧ t = ⟦number:1⟧;',
    ],
    // A stray `\"""` outside a string opens nothing.
    ['swift', 'let k = \\"""', '⟦keyword:let⟧ k = \\"⟦string:""⟧'],
    // A backslash before a line break goes on in TypeScript and Groovy only.
    [
      'typescript',
      'const a = "one \\\ntwo"; const b = \'x\\\ny\';',
      '⟦keyword:const⟧ a = ⟦string:"one \\\ntwo"⟧; ⟦keyword:const⟧ b = ⟦string:\'x\\\ny\'⟧;',
    ],
    [
      'typescript',
      'const a = "one \\\r\ntwo"; x = 1',
      '⟦keyword:const⟧ a = ⟦string:"one \\\r\ntwo"⟧; x = ⟦number:1⟧',
    ],
    [
      'groovy',
      'def a = \'one \\\ntwo\'; def b = "x ${y}\\\nz"',
      '⟦keyword:def⟧ a = ⟦string:\'one \\\ntwo\'⟧; ⟦keyword:def⟧ b = ⟦string:"x ${y}\\\nz"⟧',
    ],
    [
      'swift',
      'let a = "one \\\ntwo"',
      '⟦keyword:let⟧ a = ⟦string:"one \\⟧\ntwo⟦string:"⟧',
    ],
    // A Dart raw string in a hole takes no escapes, so its quote closes it.
    [
      'dart',
      'x = "${f(r\'\\\')}" + 1',
      'x = ⟦string:"${f(r\'\\\')}"⟧ + ⟦number:1⟧',
    ],
    // A Swift raw string: holes open with `\#(`, and a quote closes it only
    // with the same hashes after it.
    [
      'swift',
      'let s = #"a \\#(name) b"# + x',
      '⟦keyword:let⟧ s = ⟦string:#"a \\#(name) b"#⟧ + x',
    ],
    [
      'swift',
      'let s = #"\\#(f(#"x"#))"# + x',
      '⟦keyword:let⟧ s = ⟦string:#"\\#(f(#"x"#))"#⟧ + x',
    ],
    [
      'swift',
      'let s = ##"a "# \\##(n) "## + x',
      '⟦keyword:let⟧ s = ⟦string:##"a "# \\##(n) "##⟧ + x',
    ],
    [
      'swift',
      'let s = #"a \\#"b"# + x',
      '⟦keyword:let⟧ s = ⟦string:#"a \\#"b"#⟧ + x',
    ],
    [
      'swift',
      'let s = #"a\\#(f("b"))c"# + x',
      '⟦keyword:let⟧ s = ⟦string:#"a\\#(f("b"))c"#⟧ + x',
    ],
    [
      'swift',
      'let s = #"a\\#(oops\nlet t = 1',
      '⟦keyword:let⟧ s = ⟦string:#"a\\#(oops⟧\n⟦keyword:let⟧ t = ⟦number:1⟧',
    ],
    // A regex literal after an operator, a bracket or `return`: its quotes open
    // no string, and a `/` between values divides.
    [
      'typescript',
      "s.replace(/\"/g, '').split(/\\s+/)",
      "s.⟦function:replace⟧(⟦regex:/\"/g⟧, ⟦string:''⟧).⟦function:split⟧(⟦regex:/\\s+/⟧)",
    ],
    [
      'typescript',
      'return /a"b/.test(s) ? /x/i : /[/]"/',
      '⟦keyword:return⟧ ⟦regex:/a"b/⟧.⟦function:test⟧(s) ? ⟦regex:/x/i⟧ : ⟦regex:/[/]"/⟧',
    ],
    [
      'typescript',
      'z = !/^a/.test(s) && /b$/.test(t) || /c/.exec(u)',
      'z = !⟦regex:/^a/⟧.⟦function:test⟧(s) && ⟦regex:/b$/⟧.⟦function:test⟧(t) || ⟦regex:/c/⟧.⟦function:exec⟧(u)',
    ],
    [
      'typescript',
      '[1, 2].map((x) => /a/.test(x))',
      '[⟦number:1⟧, ⟦number:2⟧].⟦function:map⟧((x) => ⟦regex:/a/⟧.⟦function:test⟧(x))',
    ],
    [
      'typescript',
      'const o = { re: /x"y/g, n: 4 / 2 }',
      '⟦keyword:const⟧ o = { re: ⟦regex:/x"y/g⟧, n: ⟦number:4⟧ / ⟦number:2⟧ }',
    ],
    [
      'typescript',
      'const q = (a + b) / (c - d) / 2; x = arr[i] / 2;',
      '⟦keyword:const⟧ q = (a + b) / (c - d) / ⟦number:2⟧; x = arr[i] / ⟦number:2⟧;',
    ],
    ['typescript', 'a = b\n/ c\n/ d', 'a = b\n/ c\n/ d'],
    [
      'typescript',
      '<Foo bar={x} /> <br/> </div> {count}/{total}',
      '<⟦class-name:Foo⟧ bar={x} /> <br/> </div> {count}/{total}',
    ],
    ['typescript', 'x = /unclosed', 'x = /unclosed'],
    ['typescript', 'x = /[/', 'x = /[/'],
    // A regex body and its closing slash fit in 300 characters after the opening
    // slash; its flags do not count.
    [
      'typescript',
      'x = /' + 'a'.repeat(298) + '/g',
      'x = ⟦regex:/' + 'a'.repeat(298) + '/g⟧',
    ],
    [
      'typescript',
      'x = /' + 'a'.repeat(299) + '/g',
      'x = ⟦regex:/' + 'a'.repeat(299) + '/g⟧',
    ],
    [
      'typescript',
      'x = /' + 'a'.repeat(300) + '/g',
      'x = /' + 'a'.repeat(300) + '/g',
    ],
    // A slash starts a regex at the start of a text, on each line of a list,
    // and after `, [ { ;` and `=>`, but not after `>` in markup. Flags are `dgimsuvy`.
    ['typescript', '/a/.test(s)', '⟦regex:/a/⟧.⟦function:test⟧(s)'],
    [
      'typescript',
      '[\n  /a/,\n  /b/\n]',
      '[\n  ⟦regex:/a/⟧,\n  ⟦regex:/b/⟧\n]',
    ],
    [
      'typescript',
      'f(a, /b/); g([/c/]); if (k) { /d/.test(x); /e/.test(y) }',
      '⟦function:f⟧(a, ⟦regex:/b/⟧); ⟦function:g⟧([⟦regex:/c/⟧]); ⟦keyword:if⟧ (k) { ⟦regex:/d/⟧.⟦function:test⟧(x); ⟦regex:/e/⟧.⟦function:test⟧(y) }',
    ],
    [
      'typescript',
      'f = (a) => /re/.test(a)',
      'f = (a) => ⟦regex:/re/⟧.⟦function:test⟧(a)',
    ],
    ['typescript', '<b>/ 2 /</b>', '<b>/ ⟦number:2⟧ /</b>'],
    ['typescript', 'x = /a/dgimsuvy', 'x = ⟦regex:/a/dgimsuvy⟧'],
    // A slash that closes a tag is no regex end, `/</g` is one, and an empty
    // class is a class.
    [
      'typescript',
      '<Text>+/- 5</Text>',
      '<⟦class-name:Text⟧>+/- ⟦number:5⟧</⟦class-name:Text⟧>',
    ],
    ['typescript', '<p>100% / 50%</p>', '<p>⟦number:100⟧% / ⟦number:50⟧%</p>'],
    [
      'typescript',
      "x = s.replace(/</g, 'x'); a = /x</.test(y)",
      "x = s.⟦function:replace⟧(⟦regex:/</g⟧, ⟦string:'x'⟧); a = ⟦regex:/x</⟧.⟦function:test⟧(y)",
    ],
    ['typescript', 'x = /[]/.test(s)', 'x = ⟦regex:/[]/⟧.⟦function:test⟧(s)'],
    [
      'typescript',
      '<A.B>+/- 5</A.B><my-tag>+/- 6</my-tag>',
      '<⟦class-name:A⟧.⟦class-name:B⟧>+/- ⟦number:5⟧</⟦class-name:A⟧.⟦class-name:B⟧><my-tag>+/- ⟦number:6⟧</my-tag>',
    ],
    ['typescript', 'x is\tFoo', 'x ⟦keyword:is⟧\t⟦class-name:Foo⟧'],
    ['typescript', 'x is\n  Foo', 'x ⟦keyword:is⟧\n  ⟦class-name:Foo⟧'],
    [
      'typescript',
      'function f(s: string): s is `on${string}` {}',
      '⟦keyword:function⟧ ⟦function:f⟧(s: string): s ⟦keyword:is⟧ ⟦string:`on${string}`⟧ {}',
    ],
    [
      'typescript',
      "x is [A, B]; y is $T; z is (A | B); w is 'a'",
      "x ⟦keyword:is⟧ [⟦class-name:A⟧, ⟦class-name:B⟧]; y ⟦keyword:is⟧ $T; z ⟦keyword:is⟧ (⟦class-name:A⟧ | ⟦class-name:B⟧); w ⟦keyword:is⟧ ⟦string:'a'⟧",
    ],
    ['typescript', 'ok = is\n  && x', 'ok = is\n  && x'],
    [
      'typescript',
      'x is string[]; y is { a: 1 }; z is "a"',
      'x ⟦keyword:is⟧ string[]; y ⟦keyword:is⟧ { a: ⟦number:1⟧ }; z ⟦keyword:is⟧ ⟦string:"a"⟧',
    ],
    [
      'typescript',
      'const is = 1; ok = is && x; is ? a : b',
      '⟦keyword:const⟧ is = ⟦number:1⟧; ok = is && x; is ? a : b',
    ],
    // A regex may close right before `>`, unless a tag is open in its body.
    [
      'typescript',
      'x=/a/>b; y=/a/>>b; z=/a/>=b; if(/a/>b)w()',
      'x=⟦regex:/a/⟧>b; y=⟦regex:/a/⟧>>b; z=⟦regex:/a/⟧>=b; ⟦keyword:if⟧(⟦regex:/a/⟧>b)⟦function:w⟧()',
    ],
    ['typescript', 'x = /a<b/>c', 'x = /a<b/>c'],
    [
      'typescript',
      'x = /<a\\/b/>c; y = /<a>b/>c',
      'x = ⟦regex:/<a\\/b/⟧>c; y = ⟦regex:/<a>b/⟧>c',
    ],
    // A slash that ends a self-closing tag or a tag split over lines closes no
    // regex.
    [
      'typescript',
      '<Text>+/- 5<Br /></Text><p>50% / 2 <br/></p><b>+/- 5</b\n>',
      '<⟦class-name:Text⟧>+/- ⟦number:5⟧<⟦class-name:Br⟧ /></⟦class-name:Text⟧><p>⟦number:50⟧% / ⟦number:2⟧ <br/></p><b>+/- ⟦number:5⟧</b\n>',
    ],
    // A `..` range takes an expression in Kotlin, C# and Groovy.
    [
      'groovy',
      'x = (0..this.size())',
      'x = (⟦number:0⟧..⟦keyword:this⟧.⟦function:size⟧())',
    ],
    [
      'csharp',
      'var r = 0..this.Length',
      '⟦keyword:var⟧ r = ⟦number:0⟧..⟦keyword:this⟧.⟦class-name:Length⟧',
    ],
    // A Dart cascade names a member; a spread still takes an expression.
    [
      'dart',
      'dialog..show()..hide(); req..get = 1..on = 3',
      'dialog..⟦function:show⟧()..⟦function:hide⟧(); req..get = ⟦number:1⟧..on = ⟦number:3⟧',
    ],
    ['dart', 'x = [...this.items]', 'x = [...⟦keyword:this⟧.items]'],
    [
      'typescript',
      '<>+/- 5</><a:b>+/- 6</a:b><b>+/- 7</b >',
      '<>+/- ⟦number:5⟧</><a:b>+/- ⟦number:6⟧</a:b><b>+/- ⟦number:7⟧</b >',
    ],
    [
      'typescript',
      'x = /a/g>1; f(/a/g)',
      'x = ⟦regex:/a/g⟧>⟦number:1⟧; ⟦function:f⟧(⟦regex:/a/g⟧)',
    ],
    // TypeScript `is` is a keyword before a type, a name elsewhere.
    [
      'typescript',
      'function g(x): x is Foo { return x }',
      '⟦keyword:function⟧ ⟦function:g⟧(x): x ⟦keyword:is⟧ ⟦class-name:Foo⟧ { ⟦keyword:return⟧ x }',
    ],
    [
      'typescript',
      'function h(x): asserts x is Foo {}',
      '⟦keyword:function⟧ ⟦function:h⟧(x): ⟦keyword:asserts⟧ x ⟦keyword:is⟧ ⟦class-name:Foo⟧ {}',
    ],
    [
      'javascript',
      'f = (node, is, seen) => is(bare)',
      'f = (node, is, seen) => ⟦function:is⟧(bare)',
    ],
    // After `+ - * % ^` a slash starts a regex; after `++` or `--` it divides.
    [
      'typescript',
      'x = a + /re/.test(b); y = a++ / 2 / 3; z = a-- / 4 / 5; w = a * /c/.source; v = a - /d/.source',
      'x = a + ⟦regex:/re/⟧.⟦function:test⟧(b); y = a++ / ⟦number:2⟧ / ⟦number:3⟧; z = a-- / ⟦number:4⟧ / ⟦number:5⟧; w = a * ⟦regex:/c/⟧.source; v = a - ⟦regex:/d/⟧.source',
    ],
    [
      'typescript',
      'q = a % /e/.source; r = a ^ /f/.source',
      'q = a % ⟦regex:/e/⟧.source; r = a ^ ⟦regex:/f/⟧.source',
    ],
    // The look back stops after 200 characters: a slash that far from an
    // operator divides.
    [
      'typescript',
      'x =' + ' '.repeat(199) + '/a/.test(b)',
      'x =' + ' '.repeat(199) + '⟦regex:/a/⟧.⟦function:test⟧(b)',
    ],
    [
      'typescript',
      'x =' + ' '.repeat(200) + '/a/.test(b)',
      'x =' + ' '.repeat(200) + '/a/.⟦function:test⟧(b)',
    ],
    // A comment counts as blank before a slash, a trailing one too, and a `//`
    // in a string is no comment.
    [
      'typescript',
      'const re = // note\n /abc/',
      '⟦keyword:const⟧ re = ⟦comment:// note⟧\n ⟦regex:/abc/⟧',
    ],
    [
      'typescript',
      "x = 1; // it's\n/re/.test(y)",
      "x = ⟦number:1⟧; ⟦comment:// it's⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)",
    ],
    [
      'typescript',
      `a = "it's"; b = // c\n/re/.test(y)`,
      `a = ⟦string:"it's"⟧; b = ⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)`,
    ],
    [
      'typescript',
      'a = "x\\"y"; b = // c\n/re/.test(y)',
      'a = ⟦string:"x\\"y"⟧; b = ⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = /a\\//; y = // c\n/re/.test(y)',
      'x = ⟦regex:/a\\//⟧; y = ⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = `a // b`; y = // c\n/re/.test(y)',
      'x = ⟦string:`a // b`⟧; y = ⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      "a = 'x'; b = // c\n/re/.test(y)",
      "a = ⟦string:'x'⟧; b = ⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)",
    ],
    [
      'typescript',
      'x =// c\n/re/.test(y)',
      'x =⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    ['typescript', 'f(/</g)', '⟦function:f⟧(⟦regex:/</g⟧)'],
    [
      'typescript',
      'y = /**/ z // c\n/ n / 2',
      'y = ⟦comment:/**/⟧ z ⟦comment:// c⟧\n/ n / ⟦number:2⟧',
    ],
    [
      'typescript',
      'a = b /* c *// d\n/ n / 2',
      'a = b ⟦comment:/* c */⟧/ d\n/ n / ⟦number:2⟧',
    ],
    [
      'typescript',
      'x = /* c *///c\n/re/.test(y)',
      'x = ⟦comment:/* c */⟧⟦comment://c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'const a = /** see https://x */ b\n/ n / 2',
      '⟦keyword:const⟧ a = ⟦comment:/** see https://x */⟧ b\n/ n / ⟦number:2⟧',
    ],
    [
      'typescript',
      'files = glob("src/*.ts", // all\n  /re/)',
      'files = ⟦function:glob⟧(⟦string:"src/*.ts"⟧, ⟦comment:// all⟧\n  ⟦regex:/re/⟧)',
    ],
    [
      'typescript',
      'x =/* ab\n/re/.test(y)',
      'x =⟦comment:/* ab⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = /* ab\n/re/.test(y)',
      'x = ⟦comment:/* ab⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    // A `//` inside a block comment on the line is text, and an open block
    // comment hides the rest of its line.
    [
      'typescript',
      't = /* https://x */ s // c\n / n / 2',
      't = ⟦comment:/* https://x */⟧ s ⟦comment:// c⟧\n / n / ⟦number:2⟧',
    ],
    [
      'typescript',
      'x = /* a\n/re/.test(y)',
      'x = ⟦comment:/* a⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = "http://a" // c\n/re/.test(y)',
      'x = ⟦string:"http://a"⟧ ⟦comment:// c⟧\n/re/.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      '// c\n/re/.test(y)',
      '⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = 1;\n// a\n// b\n/re/.test(y)',
      'x = ⟦number:1⟧;\n⟦comment:// a⟧\n⟦comment:// b⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      '/* c */ /re/.test(y)',
      '⟦comment:/* c */⟧ ⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'return /* c */ /re/',
      '⟦keyword:return⟧ ⟦comment:/* c */⟧ ⟦regex:/re/⟧',
    ],
    [
      'typescript',
      'a /* c */ / 2 / 3',
      'a ⟦comment:/* c */⟧ / ⟦number:2⟧ / ⟦number:3⟧',
    ],
    [
      'typescript',
      'a // c\n/ 2 / 3',
      'a ⟦comment:// c⟧\n/ ⟦number:2⟧ / ⟦number:3⟧',
    ],
    [
      'typescript',
      'x = /* c */ a /b/ /c/.source',
      'x = ⟦comment:/* c */⟧ a /b/ /c/.source',
    ],
    [
      'typescript',
      'x = /* c */ 2 *a / 3 / 4',
      'x = ⟦comment:/* c */⟧ ⟦number:2⟧ *a / ⟦number:3⟧ / ⟦number:4⟧',
    ],
    // The `//` of a string line is no comment line, whether the line is the
    // slash's own or is cut by the 200 characters; a `/*` inside a comment is
    // text.
    [
      'typescript',
      'f(`\n//`, /re/)',
      '⟦function:f⟧(⟦string:`\n//`⟧, ⟦regex:/re/⟧)',
    ],
    [
      'typescript',
      "f(g, '//" + 'x'.repeat(193) + "', (\n/re/)",
      "⟦function:f⟧(g, ⟦string:'//" + 'x'.repeat(193) + "'⟧, (\n⟦regex:/re/⟧)",
    ],
    [
      'typescript',
      'x = /* a /*/ /re/.test(y)',
      'x = ⟦comment:/* a /*/⟧ ⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    // A block comment is skipped when the code before it is within 200
    // characters; a `*/` that ends a regex, or a line starting with `/`, is no
    // comment.
    [
      'typescript',
      'x = /*' + 'a'.repeat(193) + '*/ /re/.test(y)',
      'x = ⟦comment:/*' +
        'a'.repeat(193) +
        '*/⟧ ⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = /*' + 'a'.repeat(194) + '*/ /re/.test(y)',
      'x = ⟦comment:/*' + 'a'.repeat(194) + '*/⟧ /re/.⟦function:test⟧(y)',
    ],
    ['typescript', 'x = /a*/ /b/', 'x = ⟦regex:/a*/⟧ /b/'],
    [
      'typescript',
      'x =\n/ c\n/re/.test(y)',
      'x =\n/ c\n/re/.⟦function:test⟧(y)',
    ],
    // A comment line may start with a tab; one longer than 200 characters is
    // out of reach.
    [
      'typescript',
      'x =\n\t// c\n/re/.test(y)',
      'x =\n\t⟦comment:// c⟧\n⟦regex:/re/⟧.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x =\n// ' + 'c'.repeat(300) + '\n/re/.test(y)',
      'x =\n⟦comment:// ' + 'c'.repeat(300) + '⟧\n/re/.⟦function:test⟧(y)',
    ],
    [
      'typescript',
      'x = /[\\]/]/.test(y)',
      'x = ⟦regex:/[\\]/]/⟧.⟦function:test⟧(y)',
    ],
    // A regex holds no line break, also in a class or after a backslash, and an
    // escaped `]` stays in its class.
    ['typescript', 'x = /a\nb/.test(y)', 'x = /a\nb/.⟦function:test⟧(y)'],
    ['typescript', 'x = /[a\nb]/.test(y)', 'x = /[a\nb]/.⟦function:test⟧(y)'],
    ['typescript', 'x = /a\\\nb/.test(y)', 'x = /a\\\nb/.⟦function:test⟧(y)'],
    [
      'typescript',
      'x = /[\\]]/.test(y)',
      'x = ⟦regex:/[\\]]/⟧.⟦function:test⟧(y)',
    ],
    // `.self` and `.init` stay keywords in Swift only.
    ['swift', '.self', '.⟦keyword:self⟧'],
    [
      'typescript',
      'window.self; this.init(1)',
      'window.self; ⟦keyword:this⟧.⟦function:init⟧(⟦number:1⟧)',
    ],
    ['kotlin', 'a.init(1)', 'a.⟦function:init⟧(⟦number:1⟧)'],
    // A Swift raw string whose hole never closes runs to the line end.
    [
      'swift',
      'let s = #"a \\#(x "# b',
      '⟦keyword:let⟧ s = ⟦string:#"a \\#(x "# b⟧',
    ],
    // The member dot also holds at the start of a text, and `...` still spreads.
    ['typescript', '.get(1)', '.⟦function:get⟧(⟦number:1⟧)'],
    [
      'kotlin',
      'a = 0..it; b = 0..this.size',
      'a = ⟦number:0⟧..⟦keyword:it⟧; b = ⟦number:0⟧..⟦keyword:this⟧.size',
    ],
    ['typescript', '...new Set(a)', '...⟦keyword:new⟧ ⟦function:Set⟧(a)'],
    ['swift', '.default; .self', '.default; .⟦keyword:self⟧'],
    // A word after a member dot is a name, and `of` and `from` may be names:
    // a `/` after them divides, and a quote after them is text.
    [
      'typescript',
      'x = cfg.default / 2 / 3; y = a.of / 4 / 5; z = a?.in / 6 / 7',
      'x = cfg.default / ⟦number:2⟧ / ⟦number:3⟧; y = a.of / ⟦number:4⟧ / ⟦number:5⟧; z = a?.in / ⟦number:6⟧ / ⟦number:7⟧',
    ],
    [
      'typescript',
      'n = from / total / 2; m = of / 3 / 4',
      'n = ⟦keyword:from⟧ / total / ⟦number:2⟧; m = ⟦keyword:of⟧ / ⟦number:3⟧ / ⟦number:4⟧',
    ],
    ['typescript', "<p>cfg.default's own</p>", "<p>cfg.default's own</p>"],
    [
      'typescript',
      'f = [...yield /a/g]',
      'f = [...⟦keyword:yield⟧ ⟦regex:/a/g⟧]',
    ],
    [
      'groovy',
      'def r = ~/a"b/; def s = x =~ /c\'d/; def q = a / b',
      '⟦keyword:def⟧ r = ~⟦regex:/a"b/⟧; ⟦keyword:def⟧ s = x =~ ⟦regex:/c\'d/⟧; ⟦keyword:def⟧ q = a / b',
    ],
    // A shebang is a comment.
    [
      'javascript',
      '#!/usr/bin/env node\nx = /a/.test(y)',
      '⟦comment:#!/usr/bin/env node⟧\nx = ⟦regex:/a/⟧.⟦function:test⟧(y)',
    ],
    // JSX text: an apostrophe after a word is text; after a keyword it opens a
    // string.
    [
      'typescript',
      "<p className='x'>the user's own</p>",
      "<p className=⟦string:'x'⟧>the user's own</p>",
    ],
    [
      'typescript',
      "import x from'y'; const r = f(a)'b'",
      "⟦keyword:import⟧ x ⟦keyword:from⟧⟦string:'y'⟧; ⟦keyword:const⟧ r = ⟦function:f⟧(a)⟦string:'b'⟧",
    ],
    [
      'typescript',
      "switch (k) { case'a': return'b' }",
      "⟦keyword:switch⟧ (k) { ⟦keyword:case⟧⟦string:'a'⟧: ⟦keyword:return⟧⟦string:'b'⟧ }",
    ],
  ];
  for (const [language, source, expected] of forms) {
    assert.equal(
      highlightCode(source, language),
      marked(expected),
      `${language}: ${source}`
    );
  }
});

test('starts a regex or a string right after each word that begins an expression', () => {
  const words =
    'return typeof instanceof in new delete void throw case do else yield await import export default extends'.split(
      ' '
    );
  for (const word of words) {
    assert.equal(
      highlightCode(`${word} /a/g`, 'typescript'),
      `${t('keyword', word)} ${t('regex', '/a/g')}`,
      word
    );
  }
  // A quote may follow the word with no space; `of` and `from` too.
  for (const word of [...words, 'of', 'from']) {
    assert.equal(
      highlightCode(`${word}'x'`, 'typescript'),
      `${t('keyword', word)}${t('string', "'x'")}`,
      word
    );
  }
});

test('reads a slash by the code before it, past blanks and comments', () => {
  const next = random(7);
  const gaps = [
    ' ',
    '\t',
    '\n',
    '\r\n',
    '/* c */',
    '/**/',
    '/* a\nb */',
    '\n// c\n',
    '\n  // c\n',
    '\n\n',
  ];
  for (let i = 0; i < 300; i++) {
    let gap = '';
    for (let n = Math.floor(next() * 5); n > 0; n--) {
      gap += gaps[Math.floor(next() * gaps.length)];
    }
    for (const [code, regex] of [
      ['=', true],
      ['(', true],
      ['a', false],
      [')', false],
    ]) {
      for (const source of [
        `x ${code}${gap}/q/g`,
        `x ${code} // c\n${gap}/q/g`,
      ]) {
        assert.equal(
          highlightCode(source, 'typescript').includes(t('regex', '/q/g')),
          regex,
          JSON.stringify(source)
        );
      }
    }
  }
});

test('starts a properties key at any non-blank character', () => {
  assert.equal(
    highlightCode('\u00a0k=v', 'properties'),
    `${t('attr-name', '\u00a0k')}=${t('string', 'v')}`
  );
});

// The reserved words each language's specification lists, plus the contextual
// ones a snippet is likely to use. Words that are also common names stay plain:
// TypeScript `package`, Kotlin `annotation`, Dart `base` and `when`. A word
// dropped from a list shows here.
const words = (list) => list.split(' ');
const KEYWORDS = {
  typescript: words(
    'break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield ' +
      'let static implements interface private protected public async await of from as get set undefined ' +
      'type declare namespace module abstract readonly constructor keyof infer satisfies override asserts'
  ),
  swift: words(
    'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private precedencegroup protocol public rethrows static struct subscript typealias var ' +
      'break case catch continue default defer do else fallthrough for guard if in repeat return throw switch where while ' +
      'as await false is nil self super throws true try async willSet didSet some any'
  ),
  kotlin: words(
    'as break class continue do else false for fun if in interface is null object package return super this throw true try typealias val var when while ' +
      'abstract actual companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg ' +
      'by catch constructor finally import init where typeof'
  ),
  dart: words(
    'assert break case catch class const continue default do else enum extends false final finally for if in is new null rethrow return super switch this throw true try var void while with ' +
      'abstract as covariant deferred dynamic export extension external factory Function get implements import interface late library mixin operator part required set show static typedef ' +
      'async await hide on sealed sync yield'
  ),
  csharp: words(
    'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while ' +
      'async await var yield when nameof with record required init get set partial dynamic where not and or'
  ),
  gdscript: words(
    'if elif else for while match break continue pass return class class_name extends is in as self signal func static const enum var breakpoint preload assert await yield void and or not true false null super PI TAU INF NAN'
  ),
  groovy: words(
    'abstract as assert break case catch class const continue def default do else enum extends false final finally for goto if implements import in instanceof interface native new null package private protected public return static strictfp super switch synchronized this threadsafe throw throws trait transient true try var void volatile while boolean byte char double float int long short'
  ),
};

test('colors the reserved words of each language', () => {
  for (const [language, list] of Object.entries(KEYWORDS)) {
    for (const word of list) {
      assert.equal(
        highlightCode(word, language),
        t('keyword', word),
        `${language}: ${word}`
      );
    }
  }
  // JavaScript reads the same words as TypeScript.
  assert.equal(highlightCode('const', 'javascript'), t('keyword', 'const'));
});

test('takes a name after a member dot for no keyword', () => {
  const forms = [
    [
      'typescript',
      'a.get(1); b?.catch(c); d\n  .delete(e); [...new Set(f)]; g.type',
      'a.⟦function:get⟧(⟦number:1⟧); b?.⟦function:catch⟧(c); d\n  .⟦function:delete⟧(e); [...⟦keyword:new⟧ ⟦function:Set⟧(f)]; g.type',
    ],
    // Swift keeps `.self` and `.init`, and reads `.default` as a case.
    [
      'swift',
      'a.as(B.self); C.init(); k = .default; return .none',
      'a.⟦function:as⟧(⟦class-name:B⟧.⟦keyword:self⟧); ⟦class-name:C⟧.⟦keyword:init⟧(); k = .default; ⟦keyword:return⟧ .none',
    ],
    [
      'kotlin',
      'x?.out(1); y.is(2); z.data',
      'x?.⟦function:out⟧(⟦number:1⟧); y.⟦function:is⟧(⟦number:2⟧); z.data',
    ],
    [
      'dart',
      'a.on(b); c.in(d); e.show',
      'a.⟦function:on⟧(b); c.⟦function:in⟧(d); e.show',
    ],
    ['groovy', 'a.in(b); c.default', 'a.⟦function:in⟧(b); c.default'],
  ];
  for (const [language, source, expected] of forms) {
    assert.equal(
      highlightCode(source, language),
      marked(expected),
      `${language}: ${source}`
    );
  }
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

test('stays fast on long runs of openers that never close', () => {
  const lineStart = [
    'yaml',
    'toml',
    'properties',
    'swift',
    'csharp',
    'graphql',
  ];
  // Each run is long enough that a rescan per opener takes seconds.
  const runs = [
    ['a$'.repeat(30000), ['typescript', 'kotlin', 'groovy']],
    ['${'.repeat(50000), ['bash']],
    ['\\`\n'.repeat(50000), ['typescript']],
    // A regex class that never closes: each `/` must not scan to the end.
    ['/['.repeat(60000), ['typescript', 'javascript', 'groovy']],
    ['[/'.repeat(60000), ['typescript', 'javascript', 'groovy']],
    ['*/['.repeat(40000), ['typescript']],
    // One slash may not read through many classes that each hold a slash.
    [
      'x = /' + ('[' + '/['.repeat(50) + ']').repeat(600),
      ['typescript', 'groovy'],
    ],
    // Each slash looks back over blanks and comments, up to 200 characters.
    ['/a*/ '.repeat(30000), ['typescript']],
    ['x /*\n/a/\n'.repeat(30000), ['typescript', 'groovy']],
    ['*/ \n/a/('.repeat(30000), ['typescript']],
    ['=*/ \n/(;'.repeat(30000), ['groovy']],
    ['*/ /a/ '.repeat(20000), ['typescript', 'javascript', 'groovy']],
    ['/**/ /a/ '.repeat(20000), ['typescript']],
    ['// c\n'.repeat(30000) + '/a/', ['typescript']],
    ['a/b/'.repeat(30000), ['typescript', 'groovy']],
    [('x' + ' '.repeat(190) + '/a/').repeat(500), ['typescript']],
    ['/*\n'.repeat(60000), ['typescript', 'csharp', 'kotlin', 'swift', 'dart']],
    ['/*\n'.repeat(40000) + '*/\n'.repeat(20000), ['kotlin', 'swift', 'dart']],
    ['*/* /*\n'.repeat(15000), ['kotlin', 'swift', 'dart']],
    ['<!--'.repeat(100000), ['xml']],
    ['<!--\n'.repeat(60000), ['xml']],
    ['<' + 'k'.repeat(100000), ['xml']],
    ['<' + 'k:'.repeat(50000), ['xml']],
    ['<a ' + 'k:'.repeat(50000) + '>', ['xml']],
    ['<a ' + 'k'.repeat(100000) + '>', ['xml']],
    ['"${'.repeat(40000), ['kotlin', 'dart', 'groovy']],
    ['"\\('.repeat(40000), ['swift']],
    ['$"{'.repeat(40000), ['csharp']],
    ['"$('.repeat(40000), ['bash']],
    ['`${'.repeat(40000), ['typescript']],
    ['`${\n'.repeat(40000), ['typescript']],
    // A scan that fails far from its opener must not be repeated by every one
    // after it, whether a line break or the outer quote ends it.
    ['`${a\n'.repeat(40000) + '"\n', ['typescript']],
    ['`${\n'.repeat(40000) + '"}`\n', ['typescript']],
    ['"${\n'.repeat(40000) + '"}"\n', ['kotlin', 'groovy']],
    ["'${\n".repeat(40000) + "'}'\n", ['dart']],
    ['$"{\n'.repeat(40000), ['csharp']],
    ['"$(\n'.repeat(40000), ['bash']],
    ['<<A\n'.repeat(60000), ['bash']],
    ['<<A\nA\n'.repeat(40000), ['bash']],
    ['<<-A\n\tA\n'.repeat(30000), ['bash']],
    [Array.from({ length: 20000 }, (_, i) => `<<W${i}\n`).join(''), ['bash']],
    [
      Array.from({ length: 12000 }, (_, i) => `<<W${i}\nW${i}\n`).join(''),
      ['bash'],
    ],
    [
      Array.from({ length: 10000 }, (_, i) => `<<W${i} `).join('') +
        '\n' +
        Array.from({ length: 10000 }, (_, i) => `W${i}\n`).join(''),
      ['bash'],
    ],
    ['<<A\n' + 'word\n'.repeat(60000), ['bash']],
    ["'\n".repeat(60000), ['bash']],
    ['\\"\n'.repeat(50000), ['gdscript']],
    ['\\"""\n'.repeat(60000), ['toml']],
    ['#'.repeat(100000), ['swift']],
    ['#"""a'.repeat(40000), ['swift']],
    ['f(##"""a)'.repeat(30000), ['swift']],
    // `^` also starts after \r, U+2028 and U+2029: a class that stops at \n only
    // rescans from every one of them.
    ['[\r'.repeat(60000), ['toml']],
    ['[\u2028'.repeat(60000), ['toml']],
    ['[\u2029'.repeat(60000), ['toml']],
    ['a\u2028'.repeat(60000), ['properties']],
    ['a\u2029'.repeat(60000), ['properties']],
    ['\n'.repeat(60000) + 'x', lineStart],
    [' \r\n'.repeat(30000) + 'x', lineStart],
    ['\r'.repeat(60000) + 'x', lineStart],
    ['\u2028'.repeat(60000) + 'x', lineStart],
    ['\u2029 '.repeat(30000) + 'x', lineStart],
  ];
  for (const [source, languages] of runs) {
    for (const language of languages) {
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
  '@"',
  '#"',
  "r'",
  'r"',
  'this@A',
  '${',
  '1_',
  '0x_',
  '\\`',
  '*/*',
  '/*/',
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
      const html = highlightCode(source, language);
      assert.equal(
        problem(source, html),
        null,
        `${language} ${JSON.stringify(source)}`
      );
      // The same text gives the same output again, also after another language.
      highlightCode(source, i % 2 ? 'kotlin' : 'typescript');
      assert.equal(highlightCode(source, language), html);
    }
  }
});
