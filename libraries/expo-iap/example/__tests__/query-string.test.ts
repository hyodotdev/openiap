import {execFileSync} from 'node:child_process';
import queryString from 'query-string';

describe('Router URI decoding', () => {
  it('preserves queries, fragments, arrays and malformed input', () => {
    expect(queryString.parse('q=hello+world&plus=%2B&bad=%C3%28')).toEqual({
      q: 'hello world',
      plus: '+',
      bad: '%C3(',
    });
    expect(
      queryString.parseUrl('https://example.test/?q=a+b#a+b', {
        parseFragmentIdentifier: true,
      }),
    ).toEqual({
      url: 'https://example.test/',
      query: {q: 'a b'},
      fragmentIdentifier: 'a b',
    });
    expect(queryString.parse('q=a%2Bb', {decode: false})).toEqual({q: 'a%2Bb'});
    expect(queryString.parse('q=a%2Bb')).toEqual({q: 'a+b'});
    expect(queryString.parse('u=%E2%9C%93%C3')).toEqual({u: '✓%C3'});
    expect(queryString.parse('items=a+b&items=%2B')).toEqual({
      items: ['a b', '+'],
    });
    expect(
      queryString.parse('items[]=a+b&items[]=%2B', {arrayFormat: 'bracket'}),
    ).toEqual({items: ['a b', '+']});
  });

  it('bounds hostile percent-run decoding in the real CommonJS consumer', () => {
    const result = execFileSync(
      process.execPath,
      [
        '-e',
        `const assert = require('node:assert/strict');
const query = require(process.argv[1]);
let payload = '';
for (let i = 0; i < 32000; i++) {
  payload += '%' + Math.floor(i / 256).toString(16).padStart(2, '0')
    + '%' + (i % 256).toString(16).padStart(2, '0') + 'x';
}
payload += '%zz';
const result = query.parse('value=' + payload);
assert.equal(typeof result.value, 'string');
assert.ok(result.value.endsWith('%zz'));
console.log('decoded');`,
        require.resolve('query-string'),
      ],
      {timeout: 5000, encoding: 'utf8'},
    );
    expect(result.trim()).toBe('decoded');
  }, 10000);
});
