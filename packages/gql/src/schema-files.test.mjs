import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCHEMA_FILE_NAMES } from '../schema-files.mjs';

describe('GraphQL schema file inventory', () => {
  it('contains every root schema exactly once', () => {
    const actualFiles = readdirSync(new URL('.', import.meta.url))
      .filter((fileName) => fileName.endsWith('.graphql'))
      .sort();

    expect([...new Set(SCHEMA_FILE_NAMES)].sort()).toEqual(actualFiles);
    expect(SCHEMA_FILE_NAMES).toHaveLength(actualFiles.length);
  });
});
