// DOM-free pieces of the CodeBlock highlighter, so Node tests can run them.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Both patterns read escaped text. A quoted value is consumed whole, so a `>`
// inside it cannot end the tag; an unquoted `<` ends the search, so an unclosed
// tag stops at the next one.
const XML_MARKUP =
  /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([A-Za-z_][\w:.-]*)((?:"[^"]*"|'[^']*'|(?!&lt;)[^"'])*?)(\/?&gt;)/g;
const XML_ATTRIBUTE = /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*')/g;

// One replace per level: a pattern never sees markup an earlier one emitted.
export function highlightXml(source: string): string {
  const token = (type: string, html: string): string =>
    `<span class="token ${type}">${html}</span>`;

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
