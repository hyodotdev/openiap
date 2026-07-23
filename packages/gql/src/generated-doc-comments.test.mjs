import { describe, expect, it } from 'vitest';
import { dedupeDeprecatedJSDocTags } from '../scripts/generated-doc-comments.mjs';

describe('generated TypeScript documentation comments', () => {
  it('deduplicates tag lines without treating prose mentions as tags', () => {
    const source = `/**
 * Explains the @deprecated directive in prose.
 * @deprecated Keep the detailed reason.
 * @deprecated Drop the shorter duplicate.
 */
export interface Legacy {}

/** @deprecated Keep this single-line tag. */
export interface OtherLegacy {}`;

    const result = dedupeDeprecatedJSDocTags(source);

    expect(result).toContain('Explains the @deprecated directive in prose.');
    expect(result).toContain('@deprecated Keep the detailed reason.');
    expect(result).not.toContain('@deprecated Drop the shorter duplicate.');
    expect(result).toContain('/** @deprecated Keep this single-line tag. */');
  });
});
