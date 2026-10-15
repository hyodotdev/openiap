// Client payload lifecycle: published body, draft, and version history. Apps
// read only `productClientPayloads`; drafts and history never reach them.

import { ConvexError, v, type Infer } from "convex/values";
import { parse as parseToml } from "smol-toml";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const clientPayloadFormatValidator = v.union(
  v.literal("toml"),
  v.literal("json"),
  v.literal("text"),
);
export type ProductClientPayloadFormat = Infer<
  typeof clientPayloadFormatValidator
>;

export const MAX_PRODUCT_CLIENT_PAYLOAD_BYTES = 16 * 1024;
export const MAX_CLIENT_PAYLOAD_HISTORY = 50;
export const MAX_CLIENT_PAYLOAD_NOTE_LENGTH = 500;
// Each write appends one version, so pruning normally deletes one row.
const HISTORY_PRUNE_BATCH = 10;

export type ClientPayloadKey = {
  projectId: Id<"projects">;
  platform: "IOS" | "Android";
  productId: string;
};

export type ClientPayloadAuthor = {
  userId?: Id<"users">;
  apiKeyId?: Id<"apiKeys">;
};

export const clientPayloadWriteResultValidator = v.object({
  id: v.id("productClientPayloads"),
  created: v.boolean(),
  changed: v.boolean(),
  version: v.number(),
  updatedAt: v.number(),
});
type ClientPayloadWriteResult = Infer<typeof clientPayloadWriteResultValidator>;

export const clientPayloadDraftStateValidator = v.object({
  expectedDraftRevision: v.number(),
  draft: v.optional(
    v.object({
      format: clientPayloadFormatValidator,
      body: v.string(),
      baseVersion: v.number(),
      updatedAt: v.number(),
    }),
  ),
});
type ClientPayloadDraftState = Infer<typeof clientPayloadDraftStateValidator>;

export const clientPayloadDraftWriteResultValidator = v.object({
  changed: v.boolean(),
  revision: v.number(),
  baseVersion: v.number(),
  updatedAt: v.number(),
});
type ClientPayloadDraftWriteResult = Infer<
  typeof clientPayloadDraftWriteResultValidator
>;

const clientPayloadVersionShape = {
  version: v.number(),
  action: v.union(
    v.literal("publish"),
    v.literal("rollback"),
    v.literal("remove"),
  ),
  format: v.optional(clientPayloadFormatValidator),
  byteLength: v.optional(v.number()),
  rolledBackFrom: v.optional(v.number()),
  note: v.optional(v.string()),
  author: v.optional(
    v.object({
      type: v.union(v.literal("user"), v.literal("apiKey")),
      name: v.optional(v.string()),
    }),
  ),
  createdAt: v.number(),
};
export const clientPayloadVersionSummaryValidator = v.object(
  clientPayloadVersionShape,
);
export const clientPayloadVersionValidator = v.object({
  ...clientPayloadVersionShape,
  body: v.optional(v.string()),
});
type ClientPayloadVersionSummary = Infer<
  typeof clientPayloadVersionSummaryValidator
>;
type ClientPayloadVersion = Infer<typeof clientPayloadVersionValidator>;

type ClientPayloadErrorData = {
  [key: string]: string | number | boolean | null | undefined;
  code:
    | "CLIENT_PAYLOAD_INVALID"
    | "CLIENT_PAYLOAD_VERSION_CONFLICT"
    | "CLIENT_PAYLOAD_DRAFT_CONFLICT"
    | "CLIENT_PAYLOAD_DRAFT_NOT_FOUND"
    | "CLIENT_PAYLOAD_VERSION_NOT_FOUND"
    | "PRODUCT_NOT_FOUND"
    | "PROJECT_ACCESS_DENIED";
  message: string;
};

export function clientPayloadError(
  code: ClientPayloadErrorData["code"],
  message: string,
  details: Record<string, string | number | boolean | null | undefined> = {},
): ConvexError<ClientPayloadErrorData> {
  return new ConvexError<ClientPayloadErrorData>({
    code,
    message,
    ...details,
  });
}

/** Validate payload contents without normalizing the stored body. */
export function validateProductClientPayloadBody(
  format: ProductClientPayloadFormat,
  body: string,
): void {
  if (!body.trim()) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      "Client payload body must not be blank",
    );
  }

  const byteLength = new TextEncoder().encode(body).byteLength;
  if (byteLength > MAX_PRODUCT_CLIENT_PAYLOAD_BYTES) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      `Client payload body must be at most ${MAX_PRODUCT_CLIENT_PAYLOAD_BYTES} UTF-8 bytes`,
      { byteLength, maxBytes: MAX_PRODUCT_CLIENT_PAYLOAD_BYTES },
    );
  }

  if (format === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "Client payload body is not valid JSON",
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "JSON client payload must contain an object at the top level",
      );
    }
  } else if (format === "toml") {
    try {
      parseToml(body);
    } catch {
      throw clientPayloadError(
        "CLIENT_PAYLOAD_INVALID",
        "Client payload body is not valid TOML",
      );
    }
  }
}

function assertRevision(
  expected: number,
  actual: number | null,
  conflict: {
    code: "CLIENT_PAYLOAD_VERSION_CONFLICT" | "CLIENT_PAYLOAD_DRAFT_CONFLICT";
    message: string;
  },
  name: string,
): void {
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      `${name} must be a non-negative safe integer`,
    );
  }
  if (expected !== (actual ?? 0)) {
    throw clientPayloadError(conflict.code, conflict.message, {
      expectedVersion: expected,
      actualVersion: actual,
    });
  }
}

export function assertProductClientPayloadVersion(
  expectedVersion: number,
  actualVersion: number | null,
): void {
  assertRevision(
    expectedVersion,
    actualVersion,
    {
      code: "CLIENT_PAYLOAD_VERSION_CONFLICT",
      message: "Client payload was changed by another request",
    },
    "expectedVersion",
  );
}

function assertDraftRevision(expected: number, actual: number): void {
  assertRevision(
    expected,
    actual === 0 ? null : actual,
    {
      code: "CLIENT_PAYLOAD_DRAFT_CONFLICT",
      message: "Client payload draft was changed by another request",
    },
    "expectedDraftRevision",
  );
}

function normalizeNote(note: string | undefined): string | undefined {
  if (note === undefined || !note.trim()) return undefined;
  if (note.length > MAX_CLIENT_PAYLOAD_NOTE_LENGTH) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_INVALID",
      `note must be at most ${MAX_CLIENT_PAYLOAD_NOTE_LENGTH} characters`,
    );
  }
  return note.trim();
}

async function loadPublished(ctx: QueryCtx, key: ClientPayloadKey) {
  const [payload, summary] = await Promise.all([
    ctx.db
      .query("productClientPayloads")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", key.projectId)
          .eq("platform", key.platform)
          .eq("productId", key.productId),
      )
      .unique(),
    ctx.db
      .query("productClientPayloadSummaries")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", key.projectId)
          .eq("platform", key.platform)
          .eq("productId", key.productId),
      )
      .unique(),
  ]);
  // The summary outlives deletion, so the revision never resets (ABA).
  const revision = Math.max(payload?.version ?? 0, summary?.version ?? 0);
  const live = payload && summary?.deleted !== true ? payload : null;
  return { payload, summary, revision, live };
}

async function loadDraft(ctx: QueryCtx, key: ClientPayloadKey) {
  return await ctx.db
    .query("productClientPayloadDrafts")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("platform", key.platform)
        .eq("productId", key.productId),
    )
    .unique();
}

async function loadVersion(
  ctx: QueryCtx,
  key: ClientPayloadKey,
  version: number,
) {
  return await ctx.db
    .query("productClientPayloadVersions")
    .withIndex("by_project_and_platform_and_product_and_version", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("platform", key.platform)
        .eq("productId", key.productId)
        .eq("version", version),
    )
    .unique();
}

async function assertProductExists(
  ctx: MutationCtx,
  key: ClientPayloadKey,
): Promise<void> {
  const product = await ctx.db
    .query("products")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("platform", key.platform)
        .eq("productId", key.productId),
    )
    .unique();
  if (!product) {
    throw clientPayloadError(
      "PRODUCT_NOT_FOUND",
      "A matching product must exist before client payload can be saved",
    );
  }
}

async function syncSummary(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  summary: Doc<"productClientPayloadSummaries"> | null,
  input: {
    format: ProductClientPayloadFormat;
    version: number;
    createdAt: number;
    updatedAt: number;
  },
): Promise<void> {
  if (!summary) {
    await ctx.db.insert("productClientPayloadSummaries", {
      ...key,
      ...input,
      deleted: false,
    });
    return;
  }
  if (
    summary.format !== input.format ||
    summary.version !== input.version ||
    summary.updatedAt !== input.updatedAt ||
    summary.deleted === true
  ) {
    await ctx.db.patch(summary._id, {
      format: input.format,
      version: input.version,
      updatedAt: input.updatedAt,
      deleted: false,
    });
  }
}

/**
 * Append version history for a new revision. The current published body gets
 * an author-less entry first when it predates history, so it stays restorable.
 */
type PublishedSnapshot = Pick<
  Doc<"productClientPayloads">,
  "version" | "format" | "body" | "updatedAt"
>;

function snapshot(
  payload: Doc<"productClientPayloads"> | null,
): PublishedSnapshot | null {
  return payload
    ? {
        version: payload.version,
        format: payload.format,
        body: payload.body,
        updatedAt: payload.updatedAt,
      }
    : null;
}

async function appendVersion(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  previous: PublishedSnapshot | null,
  entry: Omit<
    Doc<"productClientPayloadVersions">,
    "_id" | "_creationTime" | keyof ClientPayloadKey
  >,
): Promise<void> {
  if (previous && !(await loadVersion(ctx, key, previous.version))) {
    await ctx.db.insert("productClientPayloadVersions", {
      ...key,
      version: previous.version,
      action: "publish",
      format: previous.format,
      body: previous.body,
      createdAt: previous.updatedAt,
    });
  }
  await ctx.db.insert("productClientPayloadVersions", { ...key, ...entry });

  const expired = await ctx.db
    .query("productClientPayloadVersions")
    .withIndex("by_project_and_platform_and_product_and_version", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("platform", key.platform)
        .eq("productId", key.productId)
        .lte("version", entry.version - MAX_CLIENT_PAYLOAD_HISTORY),
    )
    .take(HISTORY_PRUNE_BATCH);
  for (const row of expired) {
    await ctx.db.delete(row._id);
  }
}

function authorFields(author: ClientPayloadAuthor) {
  return {
    ...(author.userId ? { authorUserId: author.userId } : {}),
    ...(author.apiKeyId ? { authorApiKeyId: author.apiKeyId } : {}),
  };
}

/** Make `body` the published payload and record it in history. */
export async function publishClientPayload(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: {
    format: ProductClientPayloadFormat;
    body: string;
    expectedVersion?: number;
    action?: "publish" | "rollback";
    rolledBackFrom?: number;
    note?: string;
    author: ClientPayloadAuthor;
  },
): Promise<ClientPayloadWriteResult> {
  validateProductClientPayloadBody(input.format, input.body);
  const note = normalizeNote(input.note);
  await assertProductExists(ctx, key);

  const { payload, summary, revision, live } = await loadPublished(ctx, key);
  if (input.expectedVersion !== undefined) {
    assertProductClientPayloadVersion(
      input.expectedVersion,
      revision === 0 ? null : revision,
    );
  }

  if (
    live &&
    live.version === revision &&
    live.format === input.format &&
    live.body === input.body
  ) {
    await syncSummary(ctx, key, summary, {
      format: live.format,
      version: live.version,
      createdAt: live.createdAt,
      updatedAt: live.updatedAt,
    });
    return {
      id: live._id,
      created: false,
      changed: false,
      version: live.version,
      updatedAt: live.updatedAt,
    };
  }

  const previous = snapshot(live);
  const version = revision + 1;
  const now = Date.now();
  const fields = {
    format: input.format,
    body: input.body,
    version,
    updatedAt: now,
  };
  const id = payload
    ? payload._id
    : await ctx.db.insert("productClientPayloads", {
        ...key,
        ...fields,
        createdAt: now,
      });
  if (payload) await ctx.db.patch(payload._id, fields);
  await syncSummary(ctx, key, summary, {
    format: input.format,
    version,
    createdAt: payload?.createdAt ?? now,
    updatedAt: now,
  });
  await appendVersion(ctx, key, previous, {
    version,
    action: input.action ?? "publish",
    format: input.format,
    body: input.body,
    ...(input.rolledBackFrom !== undefined
      ? { rolledBackFrom: input.rolledBackFrom }
      : {}),
    ...(note ? { note } : {}),
    ...authorFields(input.author),
    createdAt: now,
  });
  return { id, created: !payload, changed: true, version, updatedAt: now };
}

/** Delete the published payload, keeping a tombstone revision and history. */
export async function removeClientPayload(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: { expectedVersion?: number; author: ClientPayloadAuthor },
): Promise<{ ok: boolean }> {
  const { payload, summary, revision, live } = await loadPublished(ctx, key);
  if (input.expectedVersion !== undefined) {
    assertProductClientPayloadVersion(
      input.expectedVersion,
      revision === 0 ? null : revision,
    );
  }
  if (!payload) return { ok: false };

  const previous = snapshot(live);
  const version = revision + 1;
  const updatedAt = Date.now();
  await ctx.db.delete(payload._id);
  if (summary) {
    await ctx.db.patch(summary._id, {
      format: payload.format,
      version,
      deleted: true,
      updatedAt,
    });
  } else {
    await ctx.db.insert("productClientPayloadSummaries", {
      ...key,
      format: payload.format,
      version,
      deleted: true,
      createdAt: payload.createdAt,
      updatedAt,
    });
  }
  await appendVersion(ctx, key, previous, {
    version,
    action: "remove",
    ...authorFields(input.author),
    createdAt: updatedAt,
  });
  return { ok: true };
}

/**
 * Editor view of the published payload. A deleted payload has no body, but its
 * `expectedVersion` stays monotonic so the next write creates N+1.
 */
export async function loadClientPayloadEditorState(
  ctx: QueryCtx,
  key: ClientPayloadKey,
): Promise<{
  expectedVersion: number;
  clientPayload?: {
    format: ProductClientPayloadFormat;
    body: string;
    version: number;
    updatedAt: number;
  };
}> {
  const { revision, live } = await loadPublished(ctx, key);
  return {
    expectedVersion: revision,
    ...(live
      ? {
          clientPayload: {
            format: live.format,
            body: live.body,
            version: live.version,
            updatedAt: live.updatedAt,
          },
        }
      : {}),
  };
}

export async function loadClientPayloadDraftState(
  ctx: QueryCtx,
  key: ClientPayloadKey,
): Promise<ClientPayloadDraftState> {
  const draft = await loadDraft(ctx, key);
  return {
    expectedDraftRevision: draft?.revision ?? 0,
    ...(draft?.format !== undefined && draft.body !== undefined
      ? {
          draft: {
            format: draft.format,
            body: draft.body,
            baseVersion: draft.baseVersion ?? 0,
            updatedAt: draft.updatedAt,
          },
        }
      : {}),
  };
}

export async function saveClientPayloadDraft(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: {
    format: ProductClientPayloadFormat;
    body: string;
    expectedDraftRevision?: number;
    userId?: Id<"users">;
  },
): Promise<ClientPayloadDraftWriteResult> {
  validateProductClientPayloadBody(input.format, input.body);
  await assertProductExists(ctx, key);
  const draft = await loadDraft(ctx, key);
  const currentRevision = draft?.revision ?? 0;
  if (input.expectedDraftRevision !== undefined) {
    assertDraftRevision(input.expectedDraftRevision, currentRevision);
  }

  const { revision: baseVersion } = await loadPublished(ctx, key);
  if (
    draft &&
    draft.format === input.format &&
    draft.body === input.body &&
    draft.baseVersion === baseVersion
  ) {
    return {
      changed: false,
      revision: draft.revision,
      baseVersion,
      updatedAt: draft.updatedAt,
    };
  }

  const now = Date.now();
  const fields = {
    format: input.format,
    body: input.body,
    baseVersion,
    revision: currentRevision + 1,
    ...(input.userId ? { updatedBy: input.userId } : {}),
    updatedAt: now,
  };
  if (draft) {
    await ctx.db.patch(draft._id, fields);
  } else {
    await ctx.db.insert("productClientPayloadDrafts", {
      ...key,
      ...fields,
      createdAt: now,
    });
  }
  return {
    changed: true,
    revision: fields.revision,
    baseVersion,
    updatedAt: now,
  };
}

async function clearDraft(
  ctx: MutationCtx,
  draft: Doc<"productClientPayloadDrafts">,
): Promise<void> {
  await ctx.db.patch(draft._id, {
    format: undefined,
    body: undefined,
    baseVersion: undefined,
    revision: draft.revision + 1,
    updatedAt: Date.now(),
  });
}

export async function discardClientPayloadDraft(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: { expectedDraftRevision?: number },
): Promise<{ ok: boolean }> {
  const draft = await loadDraft(ctx, key);
  if (input.expectedDraftRevision !== undefined) {
    assertDraftRevision(input.expectedDraftRevision, draft?.revision ?? 0);
  }
  if (!draft || draft.body === undefined) return { ok: false };
  await clearDraft(ctx, draft);
  return { ok: true };
}

/**
 * Publish the saved draft and clear it. Without `expectedVersion`, the publish
 * conflicts if another version went live after the draft was saved.
 */
export async function publishClientPayloadDraft(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: {
    expectedVersion?: number;
    expectedDraftRevision?: number;
    note?: string;
    author: ClientPayloadAuthor;
  },
): Promise<ClientPayloadWriteResult> {
  const draft = await loadDraft(ctx, key);
  if (input.expectedDraftRevision !== undefined) {
    assertDraftRevision(input.expectedDraftRevision, draft?.revision ?? 0);
  }
  if (!draft || draft.format === undefined || draft.body === undefined) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_DRAFT_NOT_FOUND",
      "There is no client payload draft to publish",
    );
  }
  const result = await publishClientPayload(ctx, key, {
    format: draft.format,
    body: draft.body,
    expectedVersion: input.expectedVersion ?? draft.baseVersion,
    note: input.note,
    author: input.author,
  });
  await clearDraft(ctx, draft);
  return result;
}

/** Republish a retained version's body as a new version. */
export async function rollbackClientPayload(
  ctx: MutationCtx,
  key: ClientPayloadKey,
  input: {
    toVersion: number;
    expectedVersion?: number;
    note?: string;
    author: ClientPayloadAuthor;
  },
): Promise<ClientPayloadWriteResult> {
  const entry = Number.isSafeInteger(input.toVersion)
    ? await loadVersion(ctx, key, input.toVersion)
    : null;
  if (!entry || entry.format === undefined || entry.body === undefined) {
    throw clientPayloadError(
      "CLIENT_PAYLOAD_VERSION_NOT_FOUND",
      `Version ${input.toVersion} is not a retained client payload version with a body`,
    );
  }
  return await publishClientPayload(ctx, key, {
    format: entry.format,
    body: entry.body,
    expectedVersion: input.expectedVersion,
    action: "rollback",
    rolledBackFrom: entry.version,
    note: input.note,
    author: input.author,
  });
}

async function resolveAuthorNames(
  ctx: QueryCtx,
  rows: Doc<"productClientPayloadVersions">[],
): Promise<Map<string, string | undefined>> {
  const names = new Map<string, string | undefined>();
  for (const row of rows) {
    if (row.authorUserId && !names.has(row.authorUserId)) {
      const user = await ctx.db.get(row.authorUserId);
      names.set(row.authorUserId, user?.name ?? user?.email);
    }
    if (row.authorApiKeyId && !names.has(row.authorApiKeyId)) {
      const apiKey = await ctx.db.get(row.authorApiKeyId);
      names.set(row.authorApiKeyId, apiKey?.name);
    }
  }
  return names;
}

function shapeVersion(
  row: Doc<"productClientPayloadVersions">,
  names: Map<string, string | undefined>,
): ClientPayloadVersionSummary {
  const authorId = row.authorUserId ?? row.authorApiKeyId;
  const authorName = authorId ? names.get(authorId) : undefined;
  return {
    version: row.version,
    action: row.action,
    ...(row.format ? { format: row.format } : {}),
    ...(row.body !== undefined
      ? { byteLength: new TextEncoder().encode(row.body).byteLength }
      : {}),
    ...(row.rolledBackFrom !== undefined
      ? { rolledBackFrom: row.rolledBackFrom }
      : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(authorId
      ? {
          author: {
            type: row.authorUserId ? ("user" as const) : ("apiKey" as const),
            ...(authorName ? { name: authorName } : {}),
          },
        }
      : {}),
    createdAt: row.createdAt,
  };
}

/** Retained versions, newest first, without bodies. */
export async function listClientPayloadVersions(
  ctx: QueryCtx,
  key: ClientPayloadKey,
): Promise<ClientPayloadVersionSummary[]> {
  const rows = await ctx.db
    .query("productClientPayloadVersions")
    .withIndex("by_project_and_platform_and_product_and_version", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("platform", key.platform)
        .eq("productId", key.productId),
    )
    .order("desc")
    .take(MAX_CLIENT_PAYLOAD_HISTORY);
  const names = await resolveAuthorNames(ctx, rows);
  return rows.map((row) => shapeVersion(row, names));
}

export async function getClientPayloadVersion(
  ctx: QueryCtx,
  key: ClientPayloadKey,
  version: number,
): Promise<ClientPayloadVersion | null> {
  const row = Number.isSafeInteger(version)
    ? await loadVersion(ctx, key, version)
    : null;
  if (!row) return null;
  const names = await resolveAuthorNames(ctx, [row]);
  return {
    ...shapeVersion(row, names),
    ...(row.body !== undefined ? { body: row.body } : {}),
  };
}
