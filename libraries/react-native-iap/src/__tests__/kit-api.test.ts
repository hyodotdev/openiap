import {kitApi, KitApiError} from '../kit-api';

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
