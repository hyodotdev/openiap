import { Auth } from '@auth/core';
import { neon } from '@neondatabase/serverless';
import { showcaseIdentities } from '@hyodotdev/openiap-mcp-server/showcase-schema';
import { LIBRARIES } from '../src/lib/images';
import { SHOWCASE_APPS, SHOWCASE_CATEGORIES } from '../src/lib/showcase';
import { createShowcaseHandler } from './showcase-handler';
import { createShowcaseStore } from './showcase-store';
import {
  getShowcaseAdmin,
  showcaseAuthConfig,
  type ShowcaseAuthSettings,
} from './showcase-auth';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error('Showcase configuration is incomplete');
  return value;
}

function settings(): ShowcaseAuthSettings {
  const origin = new URL(required('SHOWCASE_ORIGIN')).origin;
  if (
    !origin.startsWith('https://') &&
    !['http://localhost:3000', 'http://127.0.0.1:3000'].includes(origin)
  )
    throw new Error('Invalid showcase origin');
  const secret = required('SHOWCASE_AUTH_SECRET');
  const adminId = required('SHOWCASE_ADMIN_GITHUB_ID');
  if (secret.length < 32 || !/^\d+$/.test(adminId))
    throw new Error('Invalid showcase authentication settings');
  return {
    origin,
    secret,
    clientId: required('SHOWCASE_GITHUB_CLIENT_ID'),
    clientSecret: required('SHOWCASE_GITHUB_CLIENT_SECRET'),
    adminId,
  };
}

async function playInstalls(android?: string): Promise<number | null> {
  if (!android) return null;
  const id = new URL(android).searchParams.get('id');
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id ?? '')}&hl=en&gl=US`;
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    // Keep the parser shared with the catalog's metrics refresh.
    const { parsePlayMetrics } =
      await import('../scripts/showcase-play-metrics.mjs');
    const html = await response.text();
    if (html.length > 3 * 1024 * 1024) return null;
    return parsePlayMetrics(html, id ?? 'app').installs ?? null;
  } catch {
    return null;
  }
}

export async function handleShowcaseApi(request: Request): Promise<Response> {
  try {
    const config = settings();
    if (new URL(request.url).origin !== config.origin)
      return Response.json(
        { error: 'Use the configured showcase domain' },
        { status: 403 }
      );
    if (new URL(request.url).pathname.startsWith('/api/auth/')) {
      const response = await Auth(request, showcaseAuthConfig(config));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    const sql = neon(required('SHOWCASE_DATABASE_URL'));
    const store = createShowcaseStore((text, params) =>
      sql.query(text, params)
    );
    return await createShowcaseHandler({
      categories: SHOWCASE_CATEGORIES,
      libraries: LIBRARIES.map((library) => library.name),
      origin: config.origin,
      rateLimitSecret: config.secret,
      store,
      admin: (req) => getShowcaseAdmin(req, config),
      installs: (submission) => playInstalls(submission.android),
      existingIdentities: new Set(SHOWCASE_APPS.flatMap(showcaseIdentities)),
    })(request);
  } catch {
    return Response.json(
      { error: 'Showcase submissions are not configured yet.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
