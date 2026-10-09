import assert from 'node:assert/strict';

for (const name of [
  'SHOWCASE_ORIGIN',
  'SHOWCASE_AUTH_SECRET',
  'SHOWCASE_ADMIN_GITHUB_ID',
  'SHOWCASE_GITHUB_CLIENT_ID',
  'SHOWCASE_GITHUB_CLIENT_SECRET',
  'SHOWCASE_DATABASE_URL',
])
  delete process.env[name];

for (const [file, path] of [
  ['auth', 'auth/csrf'],
  ['showcase/apps', 'showcase/apps'],
  ['showcase/admin', 'showcase/admin'],
  ['showcase/mcp', 'showcase/mcp'],
]) {
  const { default: endpoint } = await import(
    new URL(`../api/${file}.mjs`, import.meta.url)
  );
  const response = await endpoint.fetch(
    new Request(`http://localhost:3000/api/${path}`)
  );
  assert.equal(response.status, 503);
}

Object.assign(process.env, {
  SHOWCASE_ORIGIN: 'http://localhost:3000',
  SHOWCASE_AUTH_SECRET: 'test-only-runtime-secret-with-32-characters',
  SHOWCASE_ADMIN_GITHUB_ID: '12345',
  SHOWCASE_GITHUB_CLIENT_ID: 'fixture-client',
  SHOWCASE_GITHUB_CLIENT_SECRET: 'fixture-secret',
});
const { default: auth } = await import('../api/auth.mjs');
const response = await auth.fetch(
  new Request('http://localhost:3000/api/auth?authPath=csrf')
);
assert.equal(response.status, 200);
assert.ok((await response.json()).csrfToken);
assert.ok(response.headers.get('set-cookie'));
const cancelled = await auth.fetch(
  new Request(
    'http://localhost:3000/api/auth?authPath=callback/github&error=access_denied'
  )
);
assert.equal(cancelled.status, 302);
assert.ok(cancelled.headers.get('location')?.includes('error='));
assert.equal(cancelled.headers.get('Cache-Control'), 'no-store');
console.log(
  'Showcase API modules and the rewritten auth route execute in Node.'
);
