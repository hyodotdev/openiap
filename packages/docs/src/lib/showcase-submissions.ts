import { z } from 'zod';
import {
  createShowcaseSubmissionSchema,
  hasShowcaseLink,
  type ShowcaseSubmission,
} from '@hyodotdev/openiap-mcp-server/showcase-schema';
import { LIBRARIES } from './images';
import { SHOWCASE_CATEGORIES, type ShowcaseApp } from './showcase';

const submissionSchema = createShowcaseSubmissionSchema({
  categories: SHOWCASE_CATEGORIES,
  libraries: LIBRARIES.map((library) => library.name),
});

const storedSubmissionSchema = submissionSchema.innerType().extend({
  category: z.string().trim().min(1).max(80),
  library: z.array(z.string().trim().min(1).max(80)).min(1),
});

export function submissionToShowcaseApp(
  submission: Omit<ShowcaseSubmission, 'contactEmail' | 'ownershipConfirmed'>,
  installs?: number
): ShowcaseApp {
  return {
    name: submission.name,
    tagline: submission.tagline,
    category: submission.category,
    logo: submission.logo,
    library: LIBRARIES.filter((entry) =>
      submission.library.includes(entry.name)
    ).map((entry) => entry.name),
    iapkit: submission.iapkit,
    ios: submission.ios,
    android: submission.android,
    web: submission.web,
    github: submission.github,
    installs,
  };
}

export function parseApprovedShowcaseApps(value: unknown): ShowcaseApp[] {
  const schema = storedSubmissionSchema
    .omit({
      contactEmail: true,
      ownershipConfirmed: true,
    })
    .refine(hasShowcaseLink);
  const data = z
    .object({
      apps: z.array(z.unknown()),
    })
    .parse(value);
  const row = z.object({
    app: schema,
    installs: z.number().int().nonnegative().nullable(),
  });
  return data.apps.flatMap((value) => {
    const parsed = row.safeParse(value);
    return parsed.success
      ? [
          submissionToShowcaseApp(
            parsed.data.app,
            parsed.data.installs ?? undefined
          ),
        ]
      : [];
  });
}

export const SHOWCASE_QUEUE_SCHEMA = z.object({
  submissions: z.array(
    z.object({
      id: z.string().uuid(),
      createdAt: z.string(),
      submission: storedSubmissionSchema.refine(hasShowcaseLink),
    })
  ),
});

export type ShowcaseQueuedApp = z.infer<
  typeof SHOWCASE_QUEUE_SCHEMA
>['submissions'][number];
