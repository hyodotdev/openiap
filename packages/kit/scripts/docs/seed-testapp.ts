#!/usr/bin/env bun
/**
 * Seed (or re-sync) a demo project named "TestApp" in the Convex
 * deployment pointed to by `.env.local`'s `CONVEX_URL`. Used to give
 * the docs capture script a predictable data shape to screenshot
 * against.
 *
 * Safe to run repeatedly — looks up a TestApp project in the target
 * organization and updates in place; never touches rows owned by
 * other users.
 *
 * Run:
 *   bun run scripts/docs/seed-testapp.ts
 *
 * Required env (read from `.env.local` by Bun's auto-loader):
 *   CONVEX_URL              — target Convex deployment HTTP URL.
 *   CONVEX_AUTH_TOKEN       — a signed-in user's JWT. The org / project
 *                             mutations are auth-gated, so the script
 *                             has to identify as a real user. Grab one
 *                             with `document.cookie` from a signed-in
 *                             dashboard, or run the script from a
 *                             trusted env that exposes the token.
 *
 * Optional env:
 *   DOCS_ORG_SLUG           — slug of the organization to seed into.
 *                             If the token sees exactly one org, this
 *                             is optional and we'll use that org. If
 *                             the token sees multiple, this is
 *                             required — otherwise we'd silently pick
 *                             one and risk seeding the wrong env.
 */

import { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api";

const url = process.env.CONVEX_URL;
if (!url) {
  console.error(
    "CONVEX_URL not set. Put it in .env.local (same format the dashboard uses).",
  );
  process.exit(1);
}

const authToken = process.env.CONVEX_AUTH_TOKEN;
if (!authToken) {
  console.error(
    "CONVEX_AUTH_TOKEN not set. The seed script talks to auth-gated queries\n" +
      "(getUserOrganizations / listOrganizationProjects), so it needs a real\n" +
      "user's JWT. See the header comment for how to obtain one.",
  );
  process.exit(1);
}

const client = new ConvexHttpClient(url);
client.setAuth(authToken);

const targetOrgSlug = process.env.DOCS_ORG_SLUG;

async function main() {
  const organizations = await client.query(
    api.organizations.query.getUserOrganizations,
    {},
  );
  if (!organizations || organizations.length === 0) {
    console.error(
      "No organizations visible to this token. Sign in to the dashboard first\n" +
        "and create an organization, then rerun.",
    );
    process.exit(1);
  }

  // Pick a target org. When the token sees exactly one org, fall
  // through silently — there's nothing ambiguous to disambiguate. But
  // when the token sees multiple orgs and the caller didn't pin one
  // with DOCS_ORG_SLUG, bail out rather than silently picking
  // `organizations[0]`: a single `bun run` shouldn't decide "which
  // env gets a TestApp" based on ordering of a Convex query.
  const org = targetOrgSlug
    ? organizations.find((o) => o.slug === targetOrgSlug)
    : organizations.length === 1
      ? organizations[0]
      : undefined;

  if (!org) {
    if (targetOrgSlug) {
      console.error(
        `Organization with slug "${targetOrgSlug}" not visible to this token.\n` +
          `Available slugs: ${organizations.map((o) => o.slug).join(", ")}`,
      );
    } else {
      console.error(
        "Multiple organizations visible to this token. Set DOCS_ORG_SLUG to\n" +
          "disambiguate so we don't seed the wrong environment.\n" +
          `Available slugs: ${organizations.map((o) => o.slug).join(", ")}`,
      );
    }
    process.exit(1);
  }
  console.log(`→ Using organization "${org.name}" (${org.slug}).`);

  const projects = await client.query(
    api.projects.query.listOrganizationProjects,
    { organizationId: org._id },
  );
  const existing = projects.find((p) => p.slug === "testapp");

  if (existing) {
    console.log(`→ Updating existing TestApp project (${existing._id}).`);
    await client.mutation(api.projects.mutation.updateProject, {
      projectId: existing._id,
      name: "TestApp",
      platform: "react-native",
      androidPackageName: "dev.openiap.testapp",
      iosBundleId: "dev.openiap.testapp",
    });
  } else {
    // `createProject` itself only accepts (organizationId, name,
    // slug, platform) — the identifier fields live behind the
    // `updateProject` validator which runs richer checks (reverse-
    // domain format for package names etc.). Two-step create-then-
    // update is deliberate: create gives us a projectId + default
    // API key, update backfills the identifiers.
    console.log("→ Creating new TestApp project.");
    const created = await client.mutation(api.projects.mutation.createProject, {
      organizationId: org._id,
      name: "TestApp",
      slug: "testapp",
      platform: "react-native",
    });
    await client.mutation(api.projects.mutation.updateProject, {
      projectId: created.projectId,
      androidPackageName: "dev.openiap.testapp",
      iosBundleId: "dev.openiap.testapp",
    });
    console.log(
      `   Created project ${created.projectId} with default key ${created.apiKey}.`,
    );
  }

  console.log("\n✅ TestApp is ready to screenshot.");
  console.log(
    `   Visit: ${process.env.DOCS_BASE_URL ?? "http://localhost:5173"}/${org.slug}/project/testapp/settings`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
