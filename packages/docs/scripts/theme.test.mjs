import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const colorSchemeOf = (css, selector) =>
  new RegExp(`^${selector}\\s*\\{[^}]*?color-scheme:\\s*([^;]+);`, 'm').exec(
    css
  )?.[1];

test('the light theme opts out of browser forced dark', async () => {
  assert.equal(
    colorSchemeOf(await read('src/styles/variables.css'), ':root'),
    'only light'
  );
});

test('the dark theme and first paint still declare dark support', async () => {
  assert.equal(
    colorSchemeOf(await read('src/styles/dark-mode.css'), ':root\\.dark'),
    'dark'
  );
  assert.match(
    await read('index.html'),
    /<meta name="color-scheme" content="light dark" \/>/
  );
});
