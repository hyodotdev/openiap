import {kitApi, KitApiError, type KitProductClientPayload} from '../kit-api';

const payload = {
  clientPayload: {
    format: 'text' as const,
    body: 'rules',
    version: 3,
    updatedAt: 123,
  },
};

function memoryCache() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('kitApi client payload caching', () => {
  it('persists payloads and revalidates an explicit refresh with ETag', async () => {
    const cache = memoryCache();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, {headers: {etag: '"scoped-v3"'}}),
      )
      .mockResolvedValueOnce(new Response(null, {status: 304}));
    const api = kitApi({
      apiKey: 'openiap-kit_pk_mobile',
      baseUrl: 'https://kit.test',
      fetchImpl,
      clientPayloadCache: cache,
    });

    await expect(api.clientPayload('premium', 'IOS')).resolves.toEqual(payload);
    await expect(api.clientPayload('premium', 'IOS')).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await expect(
      api.clientPayload('premium', 'IOS', {refresh: true}),
    ).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      new Headers(fetchImpl.mock.calls[1]?.[1]?.headers).get('if-none-match'),
    ).toBe('"scoped-v3"');
  });

  it('isolates persistent entries by API key and removes a cached 404', async () => {
    const cache = memoryCache();
    const firstFetch = jest
      .fn()
      .mockResolvedValue(
        Response.json(payload, {headers: {etag: '"scoped-v3"'}}),
      );
    await kitApi({
      apiKey: 'openiap-kit_pk_a',
      baseUrl: 'https://kit.test',
      fetchImpl: firstFetch,
      clientPayloadCache: cache,
    }).clientPayload('premium', 'IOS');

    const secondFetch = jest
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, {headers: {etag: '"other-v3"'}}),
      )
      .mockResolvedValueOnce(
        Response.json(
          {errors: [{code: 'NOT_FOUND', message: 'missing'}]},
          {status: 404},
        ),
      );
    const other = kitApi({
      apiKey: 'openiap-kit_pk_b',
      baseUrl: 'https://kit.test',
      fetchImpl: secondFetch,
      clientPayloadCache: cache,
    });
    await other.clientPayload('premium', 'IOS');
    expect(secondFetch).toHaveBeenCalledTimes(1);

    await expect(
      other.clientPayload('premium', 'IOS', {refresh: true}),
    ).rejects.toBeInstanceOf(KitApiError);
    expect(cache.removeItem).toHaveBeenCalledTimes(1);
  });
});

describe('kitApi requests', () => {
  const success = (value: unknown) => Response.json(value);

  it('normalizes the base URL and encodes read paths', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(success({active: false, subscription: null}))
      .mockResolvedValueOnce(
        success({userId: 'user / one', productIds: [], subscriptions: []}),
      );
    const api = kitApi({
      apiKey: 'key / one',
      baseUrl: 'https://kit.test/',
      fetchImpl,
    });

    await api.status('user / one');
    await api.entitlements('user / one');

    expect(api.apiKey).toBe('key / one');
    expect(api.baseUrl).toBe('https://kit.test');
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://kit.test/v1/subscriptions/status/key%20%2F%20one?userId=user%20%2F%20one',
      'https://kit.test/v1/subscriptions/entitlements/key%20%2F%20one?userId=user%20%2F%20one',
    ]);
  });

  it('serializes catalog options and rejects an unscoped payload read', async () => {
    const fetchImpl = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(success({products: [], hasMore: false})),
      );
    const api = kitApi({apiKey: 'key', fetchImpl});

    await api.products();
    await api.products({
      platform: 'Android',
      includeClientPayload: true,
      limit: 12,
      cursor: 'next / page',
    });

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      'https://kit.openiap.dev/v1/products/key',
      'https://kit.openiap.dev/v1/products/key?platform=Android&includeClientPayload=true&limit=12&cursor=next+%2F+page',
    ]);
    expect(() => api.products({includeClientPayload: true})).toThrow(
      'requires platform',
    );
  });

  it('posts a binding with the internal JSON headers', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(success({ok: true, bound: true}));
    const api = kitApi({apiKey: 'key', fetchImpl});

    await expect(api.bindUser('token', 'user')).resolves.toEqual({
      ok: true,
      bound: true,
    });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"purchaseToken":"token","userId":"user"}');
    const headers = new Headers(init.headers);
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('uses global fetch when no override is supplied', async () => {
    const originalFetch = globalThis.fetch;
    const globalFetch = jest
      .fn()
      .mockResolvedValue(success({active: false, subscription: null}));
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: globalFetch,
    });
    try {
      await kitApi({apiKey: 'key'}).status('user');
      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    }
  });

  it('requires an injected fetch when the runtime has no global fetch', () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      expect(() => kitApi({apiKey: 'key'})).toThrow(
        'requires a fetch implementation',
      );
    } finally {
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    }
  });

  it('merges an ETag without a global Headers constructor', async () => {
    const originalHeaders = globalThis.Headers;
    const cache = memoryCache();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        Response.json(payload, {headers: {etag: '"fallback-v3"'}}),
      )
      .mockResolvedValueOnce(new Response(null, {status: 304}));
    Object.defineProperty(globalThis, 'Headers', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      const api = kitApi({
        apiKey: 'key',
        fetchImpl,
        clientPayloadCache: cache,
      });
      await api.clientPayload('premium', 'IOS');
      await api.clientPayload('premium', 'IOS', {refresh: true});
      expect(fetchImpl.mock.calls[1]?.[1]?.headers).toEqual({
        'If-None-Match': '"fallback-v3"',
        accept: 'application/json',
      });
    } finally {
      Object.defineProperty(globalThis, 'Headers', {
        configurable: true,
        writable: true,
        value: originalHeaders,
      });
    }
  });

  it('adds default plain headers when no internal headers are provided', async () => {
    const originalHeaders = globalThis.Headers;
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(success({ok: true, bound: true}));
    Object.defineProperty(globalThis, 'Headers', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      await kitApi({apiKey: 'key', fetchImpl}).bindUser('token', 'user');
      expect(fetchImpl.mock.calls[0]?.[1]?.headers).toEqual({
        accept: 'application/json',
        'content-type': 'application/json',
      });
    } finally {
      Object.defineProperty(globalThis, 'Headers', {
        configurable: true,
        writable: true,
        value: originalHeaders,
      });
    }
  });

  it('returns null for an empty successful response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response(null));
    await expect(
      kitApi({apiKey: 'key', fetchImpl}).status('user'),
    ).resolves.toBeNull();
  });

  it.each([
    {
      response: Response.json({error: 'denied'}, {status: 403}),
      expectedBody: {error: 'denied'},
    },
    {
      response: new Response('upstream unavailable', {status: 502}),
      expectedBody: 'upstream unavailable',
    },
  ])(
    'throws a structured API error for a failed response',
    async ({response, expectedBody}) => {
      const api = kitApi({
        apiKey: 'key',
        fetchImpl: jest.fn().mockResolvedValue(response),
      });

      await expect(api.status('user')).rejects.toMatchObject({
        name: 'KitApiError',
        status: response.status,
        body: expectedBody,
      });
    },
  );

  it('throws a structured API error for a non-JSON success body', async () => {
    const api = kitApi({
      apiKey: 'key',
      fetchImpl: jest.fn().mockResolvedValue(new Response('<html>oops</html>')),
    });

    await expect(api.status('user')).rejects.toMatchObject({
      name: 'KitApiError',
      status: 200,
      body: '<html>oops</html>',
      message: expect.stringContaining('non-JSON 200 body'),
    });
  });
});

describe('kitApi cache resilience', () => {
  it.each([
    '{not-json',
    JSON.stringify({clientPayload: {format: 'binary'}}),
    JSON.stringify({
      clientPayload: {
        format: 'text',
        body: 'rules',
        version: 0,
        updatedAt: 1,
      },
    }),
    JSON.stringify({...payload, etag: 42}),
  ])('ignores an invalid cache entry', async (stored) => {
    const cache = {
      getItem: jest.fn().mockResolvedValue(stored),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const fetchImpl = jest.fn().mockResolvedValue(Response.json(payload));

    await expect(
      kitApi({
        apiKey: 'key',
        fetchImpl,
        clientPayloadCache: cache,
      }).clientPayload('premium', 'IOS'),
    ).resolves.toEqual(payload);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  // Evicting on an unknown format would kill ETag revalidation and offline
  // reads, for a value the live path forwards unchanged.
  it('serves a cached payload whose format this build predates', async () => {
    const clientPayload: KitProductClientPayload = {
      format: 'yaml',
      body: 'tier: gold',
      version: 2,
      updatedAt: 9,
    };
    const stored = {
      clientPayload,
      etag: 'W/"cached"',
    };
    const cache = {
      getItem: jest.fn().mockResolvedValue(JSON.stringify(stored)),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    const fetchImpl = jest.fn();

    await expect(
      kitApi({
        apiKey: 'key',
        fetchImpl,
        clientPayloadCache: cache,
      }).clientPayload('premium', 'IOS'),
    ).resolves.toEqual({clientPayload: stored.clientPayload});
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cache.removeItem).not.toHaveBeenCalled();
  });

  it('keeps successful reads when cache operations fail', async () => {
    const cache = {
      getItem: jest.fn().mockRejectedValue(new Error('read failed')),
      setItem: jest.fn().mockRejectedValue(new Error('write failed')),
      removeItem: jest.fn().mockRejectedValue(new Error('remove failed')),
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(Response.json(payload))
      .mockResolvedValueOnce(Response.json({error: 'missing'}, {status: 404}));
    const api = kitApi({
      apiKey: 'key',
      fetchImpl,
      clientPayloadCache: cache,
    });

    await expect(api.clientPayload('premium', 'IOS')).resolves.toEqual(payload);
    await expect(api.clientPayload('premium', 'IOS')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns a valid cached payload without an ETag and skips the network', async () => {
    const cache = memoryCache();
    cache.getItem.mockReturnValue(JSON.stringify(payload));
    const fetchImpl = jest.fn();

    await expect(
      kitApi({
        apiKey: 'key',
        fetchImpl,
        clientPayloadCache: cache,
      }).clientPayload('premium', 'Android'),
    ).resolves.toEqual(payload);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats a 304 without a cached payload as an API error', async () => {
    const api = kitApi({
      apiKey: 'key',
      fetchImpl: jest.fn().mockResolvedValue(new Response(null, {status: 304})),
    });

    await expect(api.clientPayload('premium', 'IOS')).rejects.toMatchObject({
      status: 304,
    });
  });
});
