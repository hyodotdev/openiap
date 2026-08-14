import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.mjs') ? [path] : [];
  });
}

/**
 * The suite is published for third parties to run. An import or file read that
 * escapes the package root resolves in the monorepo and fails on an installed
 * copy, which is invisible to every test that runs from this checkout.
 */
describe('published package is self-contained', () => {
  const files = sourceFiles(join(PACKAGE_ROOT, 'src'));

  it('finds the source files it is meant to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('never imports outside the package root', () => {
    const escapes = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        const specifier = match[1];
        if (!specifier.startsWith('.')) continue;
        const resolved = join(dirname(file), specifier);
        if (relative(PACKAGE_ROOT, resolved).startsWith('..')) {
          escapes.push(`${relative(PACKAGE_ROOT, file)} -> ${specifier}`);
        }
      }
    }
    expect(escapes).toEqual([]);
  });

  it('never reads files outside the package root', () => {
    const escapes = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/new URL\(\s*'([^']+)'/g)) {
        const resolved = join(dirname(file), match[1]);
        if (relative(PACKAGE_ROOT, resolved).startsWith('..')) {
          escapes.push(`${relative(PACKAGE_ROOT, file)} -> ${match[1]}`);
        }
      }
    }
    expect(escapes).toEqual([]);
  });

  it(
    'ships every source file its entrypoints need',
    () => {
      const packed = JSON.parse(
        execFileSync('npm', ['pack', '--dry-run', '--json'], {
          cwd: PACKAGE_ROOT,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 15_000,
        }),
      )[0].files.map((entry) => entry.path);

      for (const file of files) {
        const rel = relative(PACKAGE_ROOT, file);
        expect(packed, `${rel} is not in the published tarball`).toContain(rel);
      }
    },
    20_000,
  );

  it('declares a bin that does not depend on the monorepo', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
    for (const target of Object.values(manifest.bin ?? {})) {
      const path = join(PACKAGE_ROOT, target);
      expect(statSync(path).isFile()).toBe(true);
      const source = readFileSync(path, 'utf8');
      expect(source, `${target} reaches outside the package`).not.toMatch(/\.\.\/\.\.\/\.\.\//);
    }
  });
});
