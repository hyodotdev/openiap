import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  createShowcaseSubmissionSchema,
  showcaseIdentities,
} from '@hyodotdev/openiap-mcp-server/showcase-schema';
import { createShowcaseStore } from './showcase-store';
import { createShowcaseHandler, quotaClientAddress } from './showcase-handler';
import { getShowcaseAdmin } from './showcase-auth';
import { encode } from '@auth/core/jwt';
import { z } from 'zod';

const origin = 'https://showcase.test';
const options = { categories: ['Education'], libraries: ['expo-iap'] };
const submission = {
  name: 'Test app',
  tagline: 'Learn something new every day',
  category: 'Education',
  logo: 'https://example.com/icon.png',
  library: ['expo-iap'],
  iapkit: false,
  android: 'https://play.google.com/store/apps/details?id=dev.example.app',
  contactEmail: 'submitter@example.com',
  ownershipConfirmed: true as const,
};
let database: PGlite;
let store: ReturnType<typeof createShowcaseStore>;
let handler: ReturnType<typeof createShowcaseHandler>;

beforeAll(async () => {
  database = new PGlite();
  await database.exec(
    await readFile(new URL('./showcase.sql', import.meta.url), 'utf8')
  );
  store = createShowcaseStore(
    async (text, params) => (await database.query(text, params)).rows
  );
  handler = createShowcaseHandler({
    ...options,
    origin,
    rateLimitSecret: 'test-only-rate-secret',
    store,
    admin: async (request) =>
      request.headers.get('cookie') === 'test-admin=1' ? '12345' : null,
    installs: async () => 1000,
    existingIdentities: new Set(),
  });
});
beforeEach(async () => {
  await database.exec('TRUNCATE showcase_submissions, showcase_rate_limits');
});
afterAll(async () => {
  await database.close();
});

function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(`${origin}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('MCP submission stays private until authorized approval, then publishes without contact details', async () => {
  const client = new Client({ name: 'showcase-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/mcp`),
    { fetch: (input, init) => handler(new Request(input, init)) }
  );
  await client.connect(transport);
  const listed = await client.listTools();
  expect(listed.tools.map((tool) => tool.name)).toEqual([
    'openiap_showcase_options',
    'openiap_showcase_submit_app',
    'openiap_showcase_submission_status',
  ]);
  const result = await client.callTool({
    name: 'openiap_showcase_submit_app',
    arguments: submission,
  });
  expect(result.isError).not.toBe(true);
  const rows = await store.pending();
  expect(rows).toHaveLength(1);
  const receipt = JSON.parse(JSON.stringify(rows[0])) as { id: string };
  expect(await store.status(receipt.id)).toBe('pending');
  const publicBefore = await handler(request('/api/showcase/apps'));
  expect(await publicBefore.json()).toEqual({ apps: [] });
  expect((await handler(request('/api/showcase/admin'))).status).toBe(401);
  const denied = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      { origin, 'x-showcase-request': '1' }
    )
  );
  expect(denied.status).toBe(401);
  expect(await store.status(receipt.id)).toBe('pending');
  const approved = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      { cookie: 'test-admin=1', origin, 'x-showcase-request': '1' }
    )
  );
  expect(approved.status).toBe(200);
  expect(await store.status(receipt.id)).toBe('approved');
  const publicAfter = await handler(request('/api/showcase/apps'));
  const text = await publicAfter.text();
  expect(text).toContain('Test app');
  expect(text).toContain('1000');
  expect(text).not.toContain('contactEmail');
  expect(text).not.toContain('submitter@example.com');
  expect(text).not.toContain('ownershipConfirmed');
  const status = await client.callTool({
    name: 'openiap_showcase_submission_status',
    arguments: { id: receipt.id },
  });
  expect(JSON.stringify(status)).toContain('approved');
  expect(JSON.stringify(status)).not.toContain('Test app');
  await client.close();
});

test('schema rejects publication overrides, invented metrics, unsafe links, and absent consent', () => {
  const schema = createShowcaseSubmissionSchema(options);
  for (const extra of [
    { status: 'approved' },
    { installs: 99999999 },
    { stars: 99999999 },
    { ownershipConfirmed: false },
    { logo: 'javascript:alert(1)' },
    { logo: 'https://127.0.0.1/private' },
    { android: 'https://example.com/app' },
    { library: ['other-library'] },
    { category: 'Invented' },
  ]) {
    expect(schema.safeParse({ ...submission, ...extra }).success).toBe(false);
  }
  expect(schema.safeParse({ ...submission, android: undefined }).success).toBe(
    false
  );
});

test('concurrent submissions with different primary links cannot reuse an active store listing', async () => {
  const app = {
    ...submission,
    ios: 'https://apps.apple.com/us/app/test/id1234567890',
  };
  const iosOnly = {
    ...app,
    android: undefined,
    ios: 'https://apps.apple.com/kr/app/localized/id1234567890?l=ko',
  };
  const results = await Promise.allSettled([
    store.submit(app, 'first'),
    store.submit(iosOnly, 'second'),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled')
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1
  );
  const rows = z
    .array(z.object({ id: z.string() }))
    .parse(await store.pending());
  expect(rows).toHaveLength(1);
  await store.review(rows[0].id, 'rejected', '12345', null);
  expect((await store.submit(app, 'owner')).status).toBe('pending');
});

test('cross-site requests and review races cannot change a reviewed app', async () => {
  const receipt = await store.submit(submission, 'client');
  const crossSite = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      {
        cookie: 'test-admin=1',
        origin: 'https://evil.test',
        'x-showcase-request': '1',
      }
    )
  );
  expect(crossSite.status).toBe(403);
  const missingHeader = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      { cookie: 'test-admin=1', origin }
    )
  );
  expect(missingHeader.status).toBe(403);
  const reviews = await Promise.all([
    store.review(receipt.id, 'approved', '12345', 1000),
    store.review(receipt.id, 'rejected', '12345', null),
  ]);
  expect(reviews.filter(Boolean)).toHaveLength(1);
});

test('rejection remains private and duplicate submissions do not disclose the first receipt', async () => {
  const receipt = await store.submit(submission, 'first');
  await expect(store.submit(submission, 'second')).rejects.toThrow(
    'already been submitted'
  );
  expect(await store.review(receipt.id, 'rejected', '12345', null)).toBe(true);
  expect(await store.approved()).toEqual([]);
  expect(await store.pending()).toEqual([]);
  expect(await store.status(receipt.id)).toBe('rejected');
  const corrected = await store.submit(
    { ...submission, tagline: 'Updated app description for review' },
    'owner'
  );
  expect(corrected.id).not.toBe(receipt.id);
  expect(await store.status(corrected.id)).toBe('pending');
});

test('outdated categories can still be rejected and resubmitted', async () => {
  const receipt = await store.submit(
    { ...submission, category: 'Retired category' },
    'client'
  );
  const headers = { cookie: 'test-admin=1', origin, 'x-showcase-request': '1' };
  const approval = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      headers
    )
  );
  expect(approval.status).toBe(422);
  const rejection = await handler(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'rejected' },
      headers
    )
  );
  expect(rejection.status).toBe(200);
  expect(await store.status(receipt.id)).toBe('rejected');
  expect((await store.submit(submission, 'owner')).status).toBe('pending');
});

test('an app added to the curated catalog while pending cannot be approved as a hidden duplicate', async () => {
  const catalogApp = {
    ...submission,
    ios: 'https://apps.apple.com/us/app/test/id1234567890',
  };
  const iosOnly = { ...catalogApp, android: undefined };
  const receipt = await store.submit(iosOnly, 'client');
  const withCatalog = createShowcaseHandler({
    ...options,
    origin,
    rateLimitSecret: 'test-only-rate-secret',
    store,
    admin: async () => '12345',
    installs: async () => 1000,
    existingIdentities: new Set(showcaseIdentities(catalogApp)),
  });
  const response = await withCatalog(
    request(
      '/api/showcase/admin',
      { id: receipt.id, decision: 'approved' },
      {
        origin,
        'x-showcase-request': '1',
      }
    )
  );
  expect(response.status).toBe(422);
  expect(await store.status(receipt.id)).toBe('pending');
  expect(await store.approved()).toEqual([]);
  const client = new Client({ name: 'duplicate-test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      fetch: (input, init) => withCatalog(new Request(input, init)),
    })
  );
  const result = await client.callTool({
    name: 'openiap_showcase_submit_app',
    arguments: iosOnly,
  });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result)).toContain('already listed');
  expect(await store.pending()).toHaveLength(1);
  await client.close();
});

test('database rate limits hold across repeated callers and reset after the window', async () => {
  const allowed = await Promise.all(
    Array.from({ length: 130 }, () => store.allowRequest('client'))
  );
  expect(allowed.filter(Boolean)).toHaveLength(120);
  expect(
    (
      await database.query<{ count: number }>(
        "SELECT count FROM showcase_rate_limits WHERE key = 'requests:global'"
      )
    ).rows[0].count
  ).toBe(120);
  await database.query(
    'UPDATE showcase_rate_limits SET window_id = 0 WHERE key = $1',
    ['requests:client']
  );
  expect(await store.allowRequest('client')).toBe(true);
  for (let index = 0; index < 5; index++)
    await store.submit(
      {
        ...submission,
        android: `https://play.google.com/store/apps/details?id=dev.example.app${index}`,
      },
      'client'
    );
  await expect(
    store.submit(
      {
        ...submission,
        android:
          'https://play.google.com/store/apps/details?id=dev.example.app6',
      },
      'client'
    )
  ).rejects.toThrow('limit reached');
  expect(
    (
      await database.query<{ count: number }>(
        "SELECT count FROM showcase_rate_limits WHERE key = 'submissions:global'"
      )
    ).rows[0].count
  ).toBe(5);
  expect(await store.allowRequest('another-client')).toBe(true);
});

test('MCP rejects foreign origins and bounded bodies without revealing server errors', async () => {
  const denied = await handler(
    request(
      '/mcp',
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      { origin: 'https://evil.test' }
    )
  );
  expect(denied.status).toBe(403);
  const large = await handler(request('/mcp', { text: 'x'.repeat(40 * 1024) }));
  expect(large.status).toBe(413);
});

test('admin auth accepts only an encrypted session for the current GitHub account ID', async () => {
  const settings = {
    origin,
    secret: 'test-only-encryption-secret-with-32-characters',
    clientId: 'test',
    clientSecret: 'test',
    adminId: '12345',
  };
  const cookieName = '__Secure-authjs.session-token';
  const cookie = await encode({
    token: { githubId: settings.adminId, sub: 'test' },
    secret: settings.secret,
    salt: cookieName,
    maxAge: 60,
  });
  const adminRequest = request('/api/showcase/admin', undefined, {
    cookie: `${cookieName}=${cookie}`,
  });
  expect(await getShowcaseAdmin(adminRequest, settings)).toBe(settings.adminId);
  expect(
    await getShowcaseAdmin(adminRequest, { ...settings, adminId: '67890' })
  ).toBeNull();
  expect(
    await getShowcaseAdmin(
      request('/api/showcase/admin', undefined, {
        authorization: 'Bearer 12345',
      }),
      settings
    )
  ).toBeNull();
});

test('IPv6 privacy addresses share a quota while different networks remain separate', () => {
  expect(quotaClientAddress('2001:db8:1:2::1234')).toBe(
    quotaClientAddress('2001:0db8:0001:0002:ffff:aaaa:bbbb:cccc')
  );
  expect(quotaClientAddress('2001:db8:1:3::1234')).not.toBe(
    quotaClientAddress('2001:db8:1:2::1234')
  );
  expect(quotaClientAddress('::ffff:192.0.2.1')).toBe(
    quotaClientAddress('192.0.2.1')
  );
  expect(quotaClientAddress('192.0.2.2')).not.toBe(
    quotaClientAddress('192.0.2.1')
  );
  expect(quotaClientAddress('not-an-ip')).toBeNull();
});
