import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { showcaseIdentities } from '@hyodotdev/openiap-mcp-server/showcase-schema';
import {
  ShowcaseSubmissionError,
  type ShowcaseSubmission,
  type ShowcaseSubmissionStatus,
} from '@hyodotdev/openiap-mcp-server/showcase';

export type ShowcaseQuery = (
  text: string,
  params?: unknown[]
) => Promise<unknown[]>;

const statusRow = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

export function createShowcaseStore(query: ShowcaseQuery) {
  async function consume(
    key: string,
    limit: number,
    seconds: number
  ): Promise<boolean> {
    const rows = await query(
      `
      INSERT INTO showcase_rate_limits (key, window_id, count)
      VALUES ($1, floor(extract(epoch FROM now()) / $3), 1)
      ON CONFLICT (key) DO UPDATE SET
        window_id = EXCLUDED.window_id,
        updated_at = now(),
        count = CASE WHEN showcase_rate_limits.window_id = EXCLUDED.window_id
          THEN showcase_rate_limits.count + 1 ELSE 1 END
      WHERE showcase_rate_limits.window_id <> EXCLUDED.window_id OR showcase_rate_limits.count < $2
      RETURNING count
    `,
      [key, limit, seconds]
    );
    return rows.length > 0;
  }

  return {
    async allowRequest(client: string) {
      await query(
        "DELETE FROM showcase_rate_limits WHERE updated_at < now() - interval '7 days'"
      );
      return (
        (await consume(`requests:${client}`, 120, 3600)) &&
        (await consume('requests:global', 10000, 86400))
      );
    },
    async submit(submission: ShowcaseSubmission, client: string) {
      if (
        !(await consume(`submissions:${client}`, 5, 86400)) ||
        !(await consume('submissions:global', 100, 86400))
      ) {
        throw new ShowcaseSubmissionError(
          'Submission limit reached. Try again tomorrow.'
        );
      }
      const id = randomUUID();
      const identities = showcaseIdentities(submission);
      const rows = await query(
        `
        INSERT INTO showcase_submissions (id, identity, payload, play_identity, apple_identity)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT DO NOTHING
        RETURNING id
      `,
        [
          id,
          identities[0],
          JSON.stringify(submission),
          identities.find((identity) => identity.startsWith('play:')) ?? null,
          identities.find((identity) => identity.startsWith('apple:')) ?? null,
        ]
      );
      if (!rows.length)
        throw new ShowcaseSubmissionError(
          'This app has already been submitted. Contact the maintainer for updates.'
        );
      return { id, status: 'pending' as const };
    },
    async status(id: string): Promise<ShowcaseSubmissionStatus | null> {
      const rows = await query(
        'SELECT status FROM showcase_submissions WHERE id = $1',
        [id]
      );
      return rows.length ? statusRow.parse(rows[0]).status : null;
    },
    async approved(): Promise<unknown[]> {
      return query(`
        SELECT payload - 'contactEmail' - 'ownershipConfirmed' AS app, installs::double precision AS installs
        FROM showcase_submissions WHERE status = 'approved'
        ORDER BY installs DESC NULLS LAST, payload->>'name'
      `);
    },
    async pending(): Promise<unknown[]> {
      return query(`
        SELECT id, payload AS submission, created_at::text AS "createdAt"
        FROM showcase_submissions WHERE status = 'pending'
        ORDER BY created_at LIMIT 100
      `);
    },
    async review(
      id: string,
      decision: 'approved' | 'rejected',
      reviewer: string,
      installs: number | null
    ): Promise<boolean> {
      const rows = await query(
        `
        UPDATE showcase_submissions SET status = $2, reviewed_by = $3, reviewed_at = now(), installs = $4
        WHERE id = $1 AND status = 'pending' RETURNING id
      `,
        [id, decision, reviewer, installs]
      );
      return rows.length > 0;
    },
    async findPending(id: string): Promise<unknown | null> {
      const rows = await query(
        `SELECT payload FROM showcase_submissions WHERE id = $1 AND status = 'pending'`,
        [id]
      );
      return rows.length
        ? z.object({ payload: z.unknown() }).parse(rows[0]).payload
        : null;
    },
  };
}

export type ShowcaseStore = ReturnType<typeof createShowcaseStore>;
