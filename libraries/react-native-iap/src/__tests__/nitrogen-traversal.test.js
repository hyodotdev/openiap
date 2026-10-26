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
