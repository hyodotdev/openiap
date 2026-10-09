import assert from 'node:assert/strict';
import { test } from 'node:test';
import { escapeHtml, highlightXml } from '../src/lib/codeHighlight.ts';

// Highlighting only wraps text, so removing the spans must give the source back.
const plain = (html) =>
  html.replace(/<span class="token [a-z-]+">|<\/span>/g, '');

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

test('never changes the text it highlights', () => {
  const sample = `<?xml version="1.0"?>\n<!-- c -->\n<a b='1' c:d = "x > y"\n  e="2"/>\n<b>t &amp; u < v</b>`;
  for (let start = 0; start < sample.length; start++) {
    for (let end = start; end <= sample.length; end++) {
      const source = sample.slice(start, end);
      assert.equal(plain(highlightXml(source)), escapeHtml(source), source);
    }
  }
});
