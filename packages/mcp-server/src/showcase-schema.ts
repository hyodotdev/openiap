import { z } from "zod";

const APPLE_APP_ID = /\/id(\d+)$/;

export interface ShowcaseOptions {
  categories: readonly string[];
  libraries: readonly string[];
}

export interface ShowcaseAppLinks {
  android?: string;
  ios?: string;
  github?: string;
  web?: string;
}

export function hasShowcaseLink(app: ShowcaseAppLinks): boolean {
  return Boolean(app.android || app.ios || app.github || app.web);
}

const publicUrl = z
  .string()
  .trim()
  .max(1500)
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      host.includes(".") &&
      !host.endsWith(".local") &&
      !host.endsWith(".localhost") &&
      !/^[\d.]+$/.test(host) &&
      !host.includes(":")
    );
  }, "Use a public HTTPS URL without credentials or a custom port");

export function createShowcaseSubmissionSchema(options: ShowcaseOptions) {
  const [category, ...categories] = options.categories;
  const [library, ...libraries] = options.libraries;
  if (!category || !library)
    throw new Error("Showcase choices cannot be empty");
  return z
    .object({
      name: z.string().trim().min(2).max(80),
      tagline: z.string().trim().min(10).max(200),
      category: z.enum([category, ...categories]),
      logo: publicUrl,
      library: z
        .array(z.enum([library, ...libraries]))
        .min(1)
        .max(options.libraries.length)
        .transform((values) => [...new Set(values)]),
      iapkit: z.boolean().default(false),
      ios: publicUrl
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            url.hostname === "apps.apple.com" && APPLE_APP_ID.test(url.pathname)
          );
        }, "Use an apps.apple.com app link")
        .optional(),
      android: publicUrl
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            url.hostname === "play.google.com" &&
            url.pathname === "/store/apps/details" &&
            /^[A-Za-z][\w]*(?:\.[\w]+)+$/.test(url.searchParams.get("id") ?? "")
          );
        }, "Use a Google Play app link")
        .optional(),
      web: publicUrl.optional(),
      github: publicUrl
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            url.hostname === "github.com" &&
            /^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)
          );
        }, "Use a GitHub repository link")
        .optional(),
      contactEmail: z.string().trim().email().max(254),
      ownershipConfirmed: z
        .literal(true)
        .describe(
          "Confirm that you represent the app and consent to its public listing after maintainer approval",
        ),
    })
    .strict()
    .refine(hasShowcaseLink, "Provide at least one app link");
}

export type ShowcaseSubmission = z.infer<
  ReturnType<typeof createShowcaseSubmissionSchema>
>;
export type ShowcaseSubmissionStatus = "pending" | "approved" | "rejected";

export function showcaseIdentities(app: ShowcaseAppLinks): string[] {
  const identities: string[] = [];
  if (app.android)
    identities.push(`play:${new URL(app.android).searchParams.get("id")}`);
  if (app.ios)
    identities.push(
      `apple:${APPLE_APP_ID.exec(new URL(app.ios).pathname)?.[1]}`,
    );
  if (identities.length) return identities;
  if (app.github)
    return [
      `github:${new URL(app.github).pathname.replace(/\/$/, "").toLowerCase()}`,
    ];
  if (!app.web) throw new Error("An app link is required");
  const url = new URL(app.web);
  return [`web:${url.origin}${url.pathname.replace(/\/$/, "")}`];
}

export function showcaseIdentity(app: ShowcaseAppLinks): string {
  return showcaseIdentities(app)[0];
}

export class ShowcaseSubmissionError extends Error {}
