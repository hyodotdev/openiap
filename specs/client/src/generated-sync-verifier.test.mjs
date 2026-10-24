import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GENERATED_SYNC_EDGES, GENERATED_SYNC_MANIFEST } from '../generated-sync-manifest.mjs';
import { materializeGeneratedSyncEdge } from '../scripts/generated-sync-materializer.mjs';
import { collectGeneratedSyncDrift } from '../scripts/verify-generated-sync.mjs';

const temporaryRoots = [];
const repositoryRoot = resolve(import.meta.dirname, '../../..');
const clientFacade = GENERATED_SYNC_MANIFEST.purchaseFlow.source;
const expoFacade = 'libraries/expo-iap/src/purchase-flow.ts';
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

  it('keeps Node ESM imports canonical while SDK mirrors resolve their TypeScript', () => {
    const source = 'import { confirm } from "./purchase-flow-confirmers.js";\nimport type { Verdict } from "../contract.js";\nimport x from "service.js";\n';
    expect(materializeGeneratedSyncEdge({ mode: 'typescript-bundler' }, source)).toBe(
      'import { confirm } from "./purchase-flow-confirmers";\nimport type { Verdict } from "../contract";\nimport x from "service.js";\n',
    );
    expect(materializeGeneratedSyncEdge({ mode: 'copy' }, source)).toBe(source);
  });

  it.each([
    { retiring: 'Client Protocol', retiredPath: clientFacade, keptPath: expoFacade, extension: '.js' },
    { retiring: 'Expo', retiredPath: expoFacade, keptPath: clientFacade, extension: '' },
  ])('keeps compatibility ownership independent when $retiring retires its facade', ({ retiredPath, keptPath, extension }) => {
    const root = mkdtempSync(resolve(tmpdir(), 'openiap-facade-retirement-'));
    temporaryRoots.push(root);
    const sources = new Set([...GENERATED_SYNC_EDGES.map((edge) => edge.source), expoFacade]);
    for (const source of sources) {
      write(root, source, readFileSync(resolve(repositoryRoot, source), 'utf8'));
    }
    const kept = readFileSync(resolve(root, keptPath), 'utf8');
    const retired = `export * from "./purchase-flow-core${extension}";\n`;
    write(root, retiredPath, retired);

    // Run the real manifest over the real sources after only one facade retires.
    for (const edge of GENERATED_SYNC_EDGES) {
      write(root, edge.path, materializeGeneratedSyncEdge(edge, readFileSync(resolve(root, edge.source), 'utf8')));
    }

    expect(readFileSync(resolve(root, retiredPath), 'utf8')).toBe(retired);
    expect(readFileSync(resolve(root, keptPath), 'utf8')).toBe(kept);
    for (const name of [
      'createIapkitConfirmation',
      'createDeviceConfirmationIOS',
      'toIapkitVerificationProps',
      'readIapkitVerification',
    ]) {
      expect(kept).toContain(`export function ${name}`);
    }
    for (const name of ['IapkitConfirmationOptions', 'IapkitVerificationProps', 'IapkitVerificationResult']) {
      expect(kept).toContain(`export interface ${name}`);
    }
    expect(collectGeneratedSyncDrift(root)).toEqual([]);
    expect(GENERATED_SYNC_MANIFEST.purchaseFlow.targets.reactNative).toBeDefined();
    for (const name of ['purchaseFlowCore', 'purchaseFlowConfirmers']) {
      expect(GENERATED_SYNC_MANIFEST[name].targets.expo).toBeDefined();
    }
  });

  it('fails closed for an unknown manifest mode', () => {
    expect(() => materializeGeneratedSyncEdge({ groupName: 'test', targetName: 'test', mode: 'mystery' }, 'source')).toThrow(
      'Unknown sync mode "mystery"',
    );
  });
});
