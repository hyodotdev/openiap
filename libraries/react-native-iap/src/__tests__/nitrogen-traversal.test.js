const {execFileSync} = require('node:child_process');
const path = require('node:path');

it('visits shared result types once and retains their Swift bridge files', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import {getReferencedTypes} from './node_modules/nitrogen/lib/syntax/getReferencedTypes.js';
    import {StringType} from './node_modules/nitrogen/lib/syntax/types/StringType.js';
    import {TupleType} from './node_modules/nitrogen/lib/syntax/types/TupleType.js';
    import {StructType} from './node_modules/nitrogen/lib/syntax/types/StructType.js';
    import {NamedWrappingType} from './node_modules/nitrogen/lib/syntax/types/NamedWrappingType.js';
    import {SwiftCxxBridgedType} from './node_modules/nitrogen/lib/syntax/swift/SwiftCxxBridgedType.js';
    const leaf = new StringType();
    let graph = leaf;
    for (let i = 0; i < 16; i++) graph = new TupleType([graph, graph]);
    assert.equal(getReferencedTypes(graph).length, 17);
    graph = leaf;
    for (let i = 0; i < 8; i++) graph = new StructType('Probe' + i, [
      new NamedWrappingType('first', graph), new NamedWrappingType('second', graph),
    ]);
    const bridged = new SwiftCxxBridgedType(graph);
    const files = bridged.getExtraFiles();
    assert.equal(new Set(files.map(file => file.name)).size, 8);
    assert.ok(files.length <= 16);
    const names = bridged.getRequiredImports('c++').map(value => value.name);
    for (let i = 0; i < 8; i++) assert.ok(names.includes('Probe' + i + '.hpp'));
    console.log('traversal verified');
  `,
    ],
    {cwd: path.resolve(__dirname, '../..'), encoding: 'utf8'},
  );
  expect(result).toContain('traversal verified');
});

it('keeps native error constructor order stable when schema fields are reordered', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const root = path.resolve(__dirname, '../..');
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rn-iap-error-order-'),
  );
  const source = fs.readFileSync(
    path.join(root, 'src/specs/RnIapProtocol.nitro.ts'),
    'utf8',
  );
  const errorInterface = source.slice(
    source.indexOf('export interface NitroPurchaseError {'),
    source.indexOf('\nexport interface NitroBooleanOutcome'),
  );
  const fields = [
    'code: string',
    'debugMessage?: string | null',
    'isEmptyProductList?: boolean | null',
    'message: string',
    'productId?: string | null',
    'productIds?: string[] | null',
    'productType?: string | null',
    'responseCode?: number | null',
    'subResponseCodeAndroid?: SubResponseCodeAndroid | null',
  ];
  try {
    const outputs = [fields, [...fields].reverse()].map((ordered, index) => {
      const directory = path.join(temporary, String(index));
      fs.mkdirSync(path.join(directory, 'src/specs'), {recursive: true});
      fs.symlinkSync(
        path.join(root, 'node_modules'),
        path.join(directory, 'node_modules'),
        'junction',
      );
      fs.writeFileSync(
        path.join(directory, 'nitro.json'),
        JSON.stringify({
          cxxNamespace: ['errororder'],
          ios: {iosModuleName: 'ErrorOrder'},
          android: {
            androidNamespace: ['errororder'],
            androidCxxLibName: 'ErrorOrder',
          },
          autolinking: {},
          ignorePaths: ['node_modules'],
        }),
      );
      fs.writeFileSync(
        path.join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            moduleResolution: 'bundler',
            module: 'ESNext',
          },
        }),
      );
      fs.writeFileSync(
        path.join(directory, 'src/types.ts'),
        `export interface PurchaseError {${ordered.join(';')};}\nexport type SubResponseCodeAndroid = 'no-applicable-sub-response-code' | 'payment-declined-due-to-insufficient-funds' | 'user-ineligible';`,
      );
      fs.writeFileSync(
        path.join(directory, 'src/specs/ErrorOrder.nitro.ts'),
        `import type {HybridObject} from 'react-native-nitro-modules';\nimport type {PurchaseError as SchemaPurchaseError} from '../types';\n${errorInterface}\nexport interface ErrorOrder extends HybridObject<{ios:'swift'; android:'kotlin'}> {run(): Promise<NitroPurchaseError>;}`,
      );
      execFileSync(
        process.execPath,
        [
          path.join(root, 'node_modules/nitrogen/lib/index.js'),
          '.',
          '--out',
          './generated',
          '--log-level',
          'error',
        ],
        {cwd: directory, stdio: 'pipe'},
      );
      return fs.readFileSync(
        path.join(directory, 'generated/ios/swift/NitroPurchaseError.swift'),
        'utf8',
      );
    });
    expect(outputs[1]).toBe(outputs[0]);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
}, 20000);
