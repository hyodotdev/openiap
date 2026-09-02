import { describe, expect, it } from 'vitest';
import codegenConfig from '../codegen.js';
import { CodeGenerator, LANGUAGE_OUTPUT_PATHS, SUPPORTED_LANGUAGES, normalizeLanguages } from '../codegen/index.js';
import { GENERATED_SYNC_MANIFEST, generatedSourceFileName, gqlPackageRelativePath } from '../generated-sync-manifest.mjs';

describe('code generator entrypoint', () => {
  it('defaults to every implemented native/framework language', () => {
    expect(normalizeLanguages()).toEqual(SUPPORTED_LANGUAGES);
    expect(() => new CodeGenerator()).not.toThrow();
  });

  it('rejects unknown and empty language requests', () => {
    expect(() => normalizeLanguages(['kotln'])).toThrow('Unsupported codegen language: kotln');
    expect(() => normalizeLanguages([])).toThrow('At least one codegen language is required');
    expect(
      () =>
        new CodeGenerator({
          languages: ['kotln' as never],
        }),
    ).toThrow('Unsupported codegen language: kotln');
  });

  it('deduplicates validated language requests without changing order', () => {
    expect(normalizeLanguages(['kotlin', 'swift', 'kotlin'])).toEqual(['kotlin', 'swift']);
  });

  it('derives every producer output filename from the sync manifest', () => {
    const nativeGeneratedGroups = Object.entries(GENERATED_SYNC_MANIFEST)
      .filter(([groupName, definition]) => definition.generated && groupName !== 'typescript')
      .map(([groupName]) => groupName)
      .sort();

    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(nativeGeneratedGroups);
    expect(LANGUAGE_OUTPUT_PATHS).toEqual(
      Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [language, generatedSourceFileName(language)])),
    );
    expect(Object.keys(codegenConfig.generates ?? {})).toEqual([gqlPackageRelativePath(GENERATED_SYNC_MANIFEST.typescript.source)]);
  });
});
