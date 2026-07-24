import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GENERATED_SYNC_EDGES } from '../generated-sync-manifest.mjs';
import { materializeGeneratedSyncEdge } from '../scripts/generated-sync-materializer.mjs';
import { collectGeneratedSyncDrift } from '../scripts/verify-generated-sync.mjs';

const temporaryRoots = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

const write = (root, path, contents) => {
  const absolutePath = resolve(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
};

describe('generated sync verifier', () => {
  it('materializes and compares every manifest edge, including Godot', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'openiap-generated-sync-'));
    temporaryRoots.push(root);
    const sourceContents = new Map();

    for (const edge of GENERATED_SYNC_EDGES) {
      if (!sourceContents.has(edge.source)) {
        const source = edge.mode.endsWith('kotlin') ? '// canonical\npackage openiap\n' : `${edge.groupName} canonical\n`;
        sourceContents.set(edge.source, source);
        write(root, edge.source, source);
      }
      write(root, edge.path, materializeGeneratedSyncEdge(edge, sourceContents.get(edge.source)));
    }

    expect(collectGeneratedSyncDrift(root)).toEqual([]);

    const godotEdge = GENERATED_SYNC_EDGES.find((edge) => edge.groupName === 'gdscript' && edge.targetName === 'godot');
    expect(godotEdge).toBeDefined();
    write(root, godotEdge.path, `${readFileSync(resolve(root, godotEdge.path), 'utf8')}# drift\n`);
    expect(collectGeneratedSyncDrift(root)).toContain(`${godotEdge.path} is not the copy materialization of ${godotEdge.source}`);
  });

  it('fails closed for an unknown manifest mode', () => {
    expect(() => materializeGeneratedSyncEdge({ groupName: 'test', targetName: 'test', mode: 'mystery' }, 'source')).toThrow(
      'Unknown sync mode "mystery"',
    );
  });
});
