import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { publicSurfaceChanges } from "./public-declarations.mjs";

const disk = (path) => {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return undefined;
  }
};
const rn = "libraries/react-native-iap/src";
const expo = "libraries/expo-iap/src";

/** Edits real files at the head; returns the changed files the check flags. */
function flagged(edits) {
  const head = {};
  for (const [path, from, to] of edits) {
    const source = head[path] ?? disk(path);
    assert.ok(source?.includes(from), `${path} lacks: ${from}`);
    head[path] = source.replace(from, to);
  }
  return publicSurfaceChanges(Object.keys(head), (side, path) =>
    side === "head" && path in head ? head[path] : disk(path),
  ).sort();
}

test("a public SDK declaration or its JSDoc is a contract", () => {
  assert.deepEqual(
    flagged([
      [
        `${rn}/hooks/useIAP.ts`,
        "and rejects\n   * when a confirmation fails.",
        "and resolves\n   * even when a confirmation fails.",
      ],
    ]),
    [`${rn}/hooks/useIAP.ts`],
  );
  // Reached through `export * from './utils/error'`, which re-exports it.
  assert.deepEqual(
    flagged([
      [
        `${rn}/utils/errorMapping.ts`,
        "export function isRecoverableError(error: unknown): boolean {",
        "export function isRecoverableError(error: unknown, strict = false): boolean {",
      ],
    ]),
    [`${rn}/utils/errorMapping.ts`],
  );
  // Reached through index.ts's `type PublicRnIap = Omit<RnIap, ...>`.
  assert.deepEqual(
    flagged([
      [
        `${rn}/specs/RnIap.nitro.ts`,
        "  restorePurchases(): Promise<boolean>;",
        "  restorePurchases(force: boolean): Promise<boolean>;",
      ],
    ]),
    [`${rn}/specs/RnIap.nitro.ts`],
  );
  assert.deepEqual(
    flagged([
      [
        `${expo}/onside/ExpoOnsideMarketplaceAvailabilityModule.ts`,
        "export type InstalledFromOnside = boolean | null | string;",
        "export type InstalledFromOnside = boolean | null;",
      ],
    ]),
    [`${expo}/onside/ExpoOnsideMarketplaceAvailabilityModule.ts`],
  );
});

test("an Expo mirror's public change is reported at its React Native source", () => {
  const signature = "export const createPurchaseError = (";
  assert.deepEqual(
    flagged([
      [
        `${rn}/utils/errorMapping.ts`,
        signature,
        `${signature}\n  _unused?: never,\n`,
      ],
      [
        `${expo}/utils/errorMapping.ts`,
        signature,
        `${signature}\n  _unused?: never,\n`,
      ],
    ]).filter((path) => path.includes("errorMapping")),
    [`${rn}/utils/errorMapping.ts`],
  );
});

test("body-only edits and internal exports are not contracts", () => {
  assert.deepEqual(
    flagged([
      [
        `${rn}/hooks/useIAP.ts`,
        "if (status.status === 'failed') throw status.error;",
        "if (status.status === 'failed') {\n              throw status.error;\n            }",
      ],
    ]),
    [],
  );
  assert.deepEqual(
    flagged([
      [
        `${rn}/utils/errorMapping.ts`,
        "export function isNetworkError(error: unknown): boolean {",
        "export function isNetworkError(error: unknown, strict = false): boolean {",
      ],
    ]),
    [],
  );
});

test("defaults, local export aliases, imports and entry fields", () => {
  const entry = `${rn}/index.ts`;
  const module = `${rn}/make.ts`;
  const manifest = "libraries/react-native-iap/package.json";
  const base = {
    [entry]:
      "export {make, alias} from './make';\nexport {build} from './make';",
    [module]: [
      "import {Shape, Unused} from './shape';",
      "export function make(size = 5): Shape { return {size}; }",
      "function build(value: string): string { return value; }",
      "export {build as alias, build};",
    ].join("\n"),
    [`${rn}/shape.ts`]: "export type Shape = {size: number};",
    [manifest]: '{"main": "lib/index.js", "version": "1.0.0"}',
  };
  const check = (path, head) =>
    publicSurfaceChanges([path], (side, file) =>
      side === "head" && file === path ? head : base[file],
    );
  assert.deepEqual(
    check(module, base[module].replace("size = 5", "size = 50")),
    [module],
  );
  assert.deepEqual(
    check(module, base[module].replace("(value: string)", "(value: number)")),
    [module],
  );
  assert.deepEqual(
    check(module, base[module].replace("{Shape, Unused}", "{Unused, Shape}")),
    [],
  );
  assert.deepEqual(
    check(`${rn}/shape.ts`, "export type Shape = {size: string};"),
    [`${rn}/shape.ts`],
  );
  assert.deepEqual(
    check(manifest, '{"main": "lib/index.js", "version": "1.1.0"}'),
    [],
  );
  assert.deepEqual(
    check(manifest, '{"main": "lib/other.js", "version": "1.0.0"}'),
    [manifest],
  );
});

test("defaults of exported class and object members are public", () => {
  const entry = `${rn}/index.ts`;
  const module = `${rn}/client.ts`;
  const base = {
    [entry]: "export {Client, api} from './client';",
    [module]: [
      "export class Client {",
      "  constructor(readonly retries = 3) {}",
      "  fetch(limit = 10): number { return limit; }",
      "  private hidden(depth = 1): number { return depth; }",
      "}",
      "export const api = {",
      "  load(page = 1): number { return page; },",
      "  save: (force = false): boolean => force,",
      "} as const;",
    ].join("\n"),
  };
  const check = (from, to) =>
    publicSurfaceChanges([module], (side, file) =>
      side === "head" && file === module
        ? base[module].replace(from, to)
        : base[file],
    );
  for (const [from, to] of [
    ["retries = 3", "retries = 5"],
    ["limit = 10", "limit = 20"],
    ["page = 1", "page = 0"],
    ["force = false", "force = true"],
  ]) {
    assert.deepEqual(check(from, to), [module], from);
  }
  assert.deepEqual(check("depth = 1", "depth = 2"), []);
});

test("global and module augmentations in published modules are public", () => {
  const entry = `${rn}/index.ts`;
  const module = `${rn}/client.ts`;
  const polyfill = `${rn}/polyfill.ts`;
  const augment = (name) =>
    `declare global {\n  interface Window { ${name}: string }\n}\nexport {};`;
  const base = {
    [entry]: "import './polyfill';\nexport {make} from './client';",
    [module]: [
      "export function make(): number { return 1; }",
      "declare module 'react-native' {\n  interface NativeModulesStatic { Iap: unknown }\n}",
    ].join("\n"),
    [polyfill]: augment("iap"),
  };
  const check = (path, head) =>
    publicSurfaceChanges([path], (side, file) =>
      side === "head" && file === path ? head : base[file],
    );
  assert.deepEqual(
    check(module, base[module].replace("Iap: unknown", "Iap: string")),
    [module],
  );
  assert.deepEqual(check(polyfill, augment("store")), [polyfill]);
});

test("turning a value export type-only removes it at runtime", () => {
  for (const [path, from, to] of [
    [
      `${expo}/onside/index.ts`,
      "export {checkInstallationFromOnside, installedFromOnside, useOnside};",
      "export type {checkInstallationFromOnside, installedFromOnside, useOnside};",
    ],
    [
      `${rn}/utils/error.ts`,
      "export {\n  isDuplicatePurchaseError,",
      "export type {\n  isDuplicatePurchaseError,",
    ],
    [
      `${rn}/index.ts`,
      "export * from './utils/error';",
      "export type * from './utils/error';",
    ],
    // The Vega build's own entry point.
    [
      `${rn}/index.kepler.ts`,
      "export {isVegaOS} from './vega';",
      "export type {isVegaOS} from './vega';",
    ],
  ]) {
    assert.deepEqual(flagged([[path, from, to]]), [path], path);
  }
});

test("reads a .d.ts module and skips PRs outside the SDKs", () => {
  const entry = `${rn}/index.ts`;
  const ambient = `${rn}/ambient.d.ts`;
  const base = {
    [entry]: "export type {Ambient} from './ambient';",
    [ambient]: "export interface Ambient { a: string }",
  };
  assert.deepEqual(
    publicSurfaceChanges([ambient], (side, path) =>
      side === "head" && path === ambient
        ? "export interface Ambient { a: number }"
        : base[path],
    ),
    [ambient],
  );
  assert.deepEqual(
    publicSurfaceChanges(["specs/client/src/type.graphql"], () => {
      throw new Error("read outside the SDKs");
    }),
    [],
  );
});

test("an inferred public type changed by an internal module flags that module", () => {
  const entry = `${rn}/index.ts`;
  const make = `${rn}/make.ts`;
  const compute = `${rn}/compute.ts`;
  const base = {
    [entry]: "export {make} from './make';",
    // make's return type is only inferred, through compute.
    [make]:
      "import {compute} from './compute';\nexport const make = () => ({size: compute()});",
    [compute]: "export function compute() { return 1; }",
  };
  const check = (head) =>
    publicSurfaceChanges([compute], (side, file) =>
      side === "head" && file === compute ? head : base[file],
    );
  assert.deepEqual(check("export function compute() { return 'one'; }"), [
    compute,
  ]);
  assert.deepEqual(
    check("export function compute() { const one = 1; return one; }"),
    [],
  );
});

test("an unresolved dependency type fails the check instead of hiding as any", () => {
  const entry = `${rn}/index.ts`;
  const sources = {
    [entry]: "export {make} from './make';",
    [`${rn}/make.ts`]:
      "import {Shape} from 'not-installed';\nexport const make = (): Shape => ({});",
  };
  const manifest = "libraries/react-native-iap/package.json";
  const read = (side, file) =>
    side === "head" && file === `${rn}/make.ts`
      ? sources[file].replace("({})", "({size: 1})")
      : file === manifest
        ? '{"dependencies": {"not-installed": "1.0.0"}}'
        : sources[file];
  assert.throws(
    () =>
      publicSurfaceChanges([`${rn}/make.ts`], read, {
        requireDependencies: true,
      }),
    /Install the SDK dependencies.*not-installed/,
  );
  // A package the PR adds is not installed from main's lockfile; it cannot
  // block the check.
  const added = (side, file) =>
    file === manifest
      ? side === "head"
        ? '{"dependencies": {"brand-new-dep": "1.0.0"}}'
        : "{}"
      : side === "head" && file === `${rn}/make.ts`
        ? "import {nanoid} from 'brand-new-dep';\nexport const make = (): string => nanoid();"
        : file === `${rn}/make.ts`
          ? "export const make = (): string => 'id';"
          : sources[file];
  assert.doesNotThrow(() =>
    publicSurfaceChanges([`${rn}/make.ts`, manifest], added, {
      requireDependencies: true,
    }),
  );
});
