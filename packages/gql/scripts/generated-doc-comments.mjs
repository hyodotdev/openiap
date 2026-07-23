const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g;
const DEPRECATED_TAG_LINE = /^\s*(?:\/\*\*|\*)\s*@deprecated\b/;

/**
 * Keep the first real `@deprecated` JSDoc tag in each block.
 *
 * GraphQL codegen appends the directive reason after the schema description.
 * Descriptions also carry richer deprecation guidance for non-TypeScript
 * generators, so TypeScript can receive two tags. Prose that merely mentions
 * `@deprecated` must remain untouched.
 */
export function dedupeDeprecatedJSDocTags(source) {
  return source.replace(JSDOC_BLOCK, (block) => {
    let hasDeprecatedTag = false;
    return block
      .split('\n')
      .filter((line) => {
        if (!DEPRECATED_TAG_LINE.test(line)) return true;
        if (hasDeprecatedTag) return false;
        hasDeprecatedTag = true;
        return true;
      })
      .join('\n');
  });
}
