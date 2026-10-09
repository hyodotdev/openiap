import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { showcaseIdentities } from '@hyodotdev/openiap-mcp-server/showcase-schema';
import {
  createShowcaseSubmissionSchema,
  handleShowcaseMcpRequest,
  isShowcaseOriginAllowed,
  readShowcaseJson,
  ShowcaseSubmissionError,
  type ShowcaseOptions,
  type ShowcaseSubmission,
} from '@hyodotdev/openiap-mcp-server/showcase';
import type { ShowcaseStore } from './showcase-store';

const reviewSchema = z
  .object({ id: z.string().uuid(), decision: z.enum(['approved', 'rejected']) })
  .strict();

export interface ShowcaseHandlerOptions extends ShowcaseOptions {
  origin: string;
  rateLimitSecret: string;
  store: ShowcaseStore;
  admin: (request: Request) => Promise<string | null>;
  installs: (submission: ShowcaseSubmission) => Promise<number | null>;
  existingIdentities: ReadonlySet<string>;
}

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function quotaClientAddress(address: string): string | null {
  if (address === 'local' || isIP(address) === 4) return address;
  if (isIP(address) !== 6) return null;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const start = left ? left.split(':') : [];
  const end = right ? right.split(':') : [];
  const groups =
    right === undefined
      ? start
      : [...start, ...Array(8 - start.length - end.length).fill('0'), ...end];
  if (
    groups.slice(0, 5).every((group) => Number.parseInt(group, 16) === 0) &&
    groups[5] === 'ffff'
  ) {
    const high = Number.parseInt(groups[6], 16);
    const low = Number.parseInt(groups[7], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  // IPv6 privacy addresses share their network's quota.
  return (
    groups
      .slice(0, 4)
      .map((group) => Number.parseInt(group, 16).toString(16))
      .join(':') + '::/64'
  );
}

export function createShowcaseHandler(options: ShowcaseHandlerOptions) {
  const schema = createShowcaseSubmissionSchema(options);
  return async function handle(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/showcase/apps' && request.method === 'GET') {
        const response = json({ apps: await options.store.approved() });
        response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60');
        return response;
      }
      if (path === '/api/showcase/admin') {
        const admin = await options.admin(request);
        if (!admin)
          return json(
            { error: 'Sign in with the maintainer GitHub account.' },
            401
          );
        if (request.method === 'GET')
          return json({ submissions: await options.store.pending() });
        if (request.method !== 'POST')
          return json({ error: 'Method not allowed' }, 405);
        if (
          request.headers.get('origin') !== options.origin ||
          request.headers.get('x-showcase-request') !== '1'
        )
          return json({ error: 'Invalid request origin' }, 403);
        const decision = reviewSchema.parse(await readShowcaseJson(request));
        const pending = await options.store.findPending(decision.id);
        if (!pending)
          return json(
            { error: 'This submission has already been reviewed.' },
            409
          );
        let installs: number | null = null;
        if (decision.decision === 'approved') {
          const parsed = schema.safeParse(pending);
          if (!parsed.success)
            return json(
              {
                error:
                  'This submission uses outdated fields. Reject it and ask for an updated submission.',
              },
              422
            );
          if (
            showcaseIdentities(parsed.data).some((identity) =>
              options.existingIdentities.has(identity)
            )
          )
            return json(
              {
                error:
                  'This app is already listed. Reject the duplicate submission.',
              },
              422
            );
          installs = await options.installs(parsed.data);
        }
        const reviewed = await options.store.review(
          decision.id,
          decision.decision,
          admin,
          installs
        );
        return reviewed
          ? json({ status: decision.decision })
          : json({ error: 'This submission has already been reviewed.' }, 409);
      }
      if (path === '/api/showcase/mcp' || path === '/mcp') {
        const origin = request.headers.get('origin');
        if (!isShowcaseOriginAllowed(origin, options.origin))
          return json({ error: 'Origin not allowed' }, 403);
        if (request.method === 'POST') {
          // Vercel overwrites this header; never trust client-supplied IPs on another host.
          const ip =
            process.env.VERCEL === '1'
              ? request.headers.get('x-vercel-forwarded-for')
              : 'local';
          const address = ip ? quotaClientAddress(ip) : null;
          if (!address)
            return json({ error: 'Request identity unavailable' }, 503);
          const client = createHmac('sha256', options.rateLimitSecret)
            .update(address)
            .digest('hex');
          if (!(await options.store.allowRequest(client)))
            return json(
              { error: 'Request limit reached. Try again later.' },
              429
            );
          return handleShowcaseMcpRequest(request, {
            ...options,
            submit: async (value) => {
              const submission = schema.parse(value);
              if (
                showcaseIdentities(submission).some((identity) =>
                  options.existingIdentities.has(identity)
                )
              )
                throw new ShowcaseSubmissionError(
                  'This app is already listed. Contact the maintainer for updates.'
                );
              return options.store.submit(submission, client);
            },
            status: (id) => options.store.status(id),
          });
        }
        return handleShowcaseMcpRequest(request, {
          ...options,
          submit: async () => {
            throw new Error('No submission outside POST');
          },
          status: (id) => options.store.status(id),
        });
      }
      return json({ error: 'Not found' }, 404);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: 'Invalid request fields' }, 400);
      if (error instanceof ShowcaseSubmissionError)
        return json({ error: error.message }, 413);
      return json(
        { error: 'Showcase service is temporarily unavailable.' },
        503
      );
    }
  };
}
