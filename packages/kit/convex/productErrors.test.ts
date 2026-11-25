// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { APP_ERROR_SCOPE } from "./utils/errors";

const modules = import.meta.glob("./**/*.ts");
const UNKNOWN_KEY = `openiap-kit_sk_${"0".repeat(64)}`;

async function fixture() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner", email: "owner@example.invalid" }),
  );
  const owner = t.withIdentity({
    subject: `${userId}|browser`,
    issuer: "https://test.convex.site",
  });
  const org = await owner.mutation(
    api.organizations.mutation.createOrganization,
    { name: "Errors" },
  );
  const { projectId } = await owner.mutation(
    api.projects.mutation.createProject,
    { organizationId: org.organizationId, name: "App" },
  );
  const { key } = await owner.mutation(api.apiKeys.mutation.create, {
    projectId,
    name: "Server",
    keyType: "secret",
  });
  return { t, key, owner, projectId };
}

// The dashboard and the CLI read these; they must not change.
async function dashboard(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ConvexError);
  const data = (error as ConvexError<Record<string, string>>).data;
  expect(data.scope).toBe(APP_ERROR_SCOPE);
  return { code: data.code, message: data.message };
}

// `/v1` turns a dashboard-scoped error into a 500, so these must not be one.
async function published(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ConvexError);
  const data = (error as ConvexError<Record<string, string>>).data;
  expect(data.scope).not.toBe(APP_ERROR_SCOPE);
  return { code: data.code, message: data.message };
}

const product = {
  productId: "premium",
  platform: "IOS" as const,
  type: "NonConsumable" as const,
  title: "Premium",
};

describe("/v1 product errors", () => {
  it("names an unknown key on every product write and sync path", async () => {
    const { t } = await fixture();
    const invalid = {
      code: "INVALID_API_KEY",
      message: "API key is invalid or inactive",
    };
    expect(
      await published(
        t.mutation(api.products.mutation.upsertProduct, {
          apiKey: UNKNOWN_KEY,
          ...product,
        }),
      ),
    ).toEqual(invalid);
    expect(
      await published(
        t.mutation(api.products.mutation.setProductState, {
          apiKey: UNKNOWN_KEY,
          productId: "premium",
          platform: "IOS",
          state: "Active",
        }),
      ),
    ).toEqual(invalid);
    expect(
      await published(
        t.mutation(api.products.jobs.enqueueProductSync, {
          apiKey: UNKNOWN_KEY,
          platform: "IOS",
        }),
      ),
    ).toEqual(invalid);
    expect(
      await published(
        t.query(api.products.jobs.getSyncJobById, {
          apiKey: UNKNOWN_KEY,
          jobId: "missing",
        }),
      ),
    ).toEqual(invalid);
    expect(
      await published(
        t.mutation(api.products.jobs.cancelProductSync, {
          apiKey: UNKNOWN_KEY,
          jobId: "missing",
        }),
      ),
    ).toEqual(invalid);
  });

  it("names a missing product or sync job for a valid key", async () => {
    const { t, key } = await fixture();
    expect(
      await published(
        t.mutation(api.products.mutation.setProductState, {
          apiKey: key,
          productId: "premium",
          platform: "IOS",
          state: "Active",
        }),
      ),
    ).toEqual({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    const missingJob = { code: "NOT_FOUND", message: "Sync job not found" };
    expect(
      await published(
        t.query(api.products.jobs.getSyncJobById, { apiKey: key, jobId: "x" }),
      ),
    ).toEqual(missingJob);
    expect(
      await published(
        t.mutation(api.products.jobs.cancelProductSync, {
          apiKey: key,
          jobId: "x",
        }),
      ),
    ).toEqual(missingJob);
  });

  it("keeps dashboard and CLI session errors as they were", async () => {
    const { t, owner, projectId } = await fixture();
    const session = `session-project:${projectId}`;
    expect(
      await dashboard(
        t.mutation(api.products.mutation.upsertProduct, {
          apiKey: session,
          ...product,
        }),
      ),
    ).toEqual({ code: "API_KEY_INVALID", message: "Invalid API key" });
    expect(
      await dashboard(
        t.query(api.products.jobs.getSyncJobById, {
          apiKey: session,
          jobId: "x",
        }),
      ),
    ).toMatchObject({ code: "PROJECT_NOT_FOUND" });
    expect(
      await dashboard(
        owner.query(api.products.jobs.getSyncJobById, {
          apiKey: session,
          jobId: "x",
        }),
      ),
    ).toEqual({ code: "INVALID_INPUT", message: "Sync job not found" });
    expect(
      await dashboard(
        owner.mutation(api.products.jobs.cancelProductSync, {
          projectId,
          jobId: "x",
        }),
      ),
    ).toEqual({ code: "INVALID_INPUT", message: "Sync job not found" });
    expect(
      await dashboard(
        owner.mutation(api.products.mutation.setProductState, {
          projectId,
          productId: "premium",
          platform: "IOS",
          state: "Active",
        }),
      ),
    ).toEqual({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
    await owner.mutation(api.products.jobs.enqueueProductSync, {
      projectId,
      platform: "IOS",
      direction: "pull",
    });
    expect(
      await dashboard(
        owner.mutation(api.products.jobs.enqueueProductSync, {
          projectId,
          platform: "IOS",
          direction: "push",
        }),
      ),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });

  it("names a conflicting sync as invalid input", async () => {
    const { t, key } = await fixture();
    await t.mutation(api.products.jobs.enqueueProductSync, {
      apiKey: key,
      platform: "IOS",
      direction: "pull",
    });
    expect(
      await published(
        t.mutation(api.products.jobs.enqueueProductSync, {
          apiKey: key,
          platform: "IOS",
          direction: "push",
        }),
      ),
    ).toMatchObject({ code: "INVALID_INPUT" });
  });
});
