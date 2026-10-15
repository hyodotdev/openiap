import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { MemoryDb, memoryCtx } from "../purchaseIssues/memoryDb.testing";
import { testableFunction } from "../test.setup";
import { listSubscriptions as registeredListSubscriptions } from "../subscriptions/query";
import {
  getPurchaseById as registeredGetPurchaseById,
  getReceiptsByProject as registeredGetReceiptsByProject,
} from "./query";

const getPurchaseById = testableFunction(registeredGetPurchaseById);
const getReceiptsByProject = testableFunction(registeredGetReceiptsByProject);
const listSubscriptions = testableFunction(registeredListSubscriptions);
const SECRET_KEY = "openiap-kit_sk_server";
const PROJECT = "projects_1" as Id<"projects">;
const TOKEN = "google-purchase-token-value";
const RESPONSE = JSON.stringify({ orderId: "GPA.1", productLineItem: [] });

function setup() {
  const db = new MemoryDb();
  db.seed("organizations", { _id: "organizations_1" });
  db.seed("projects", { _id: PROJECT, organizationId: "organizations_1" });
  for (const role of ["owner", "admin", "member"]) {
    db.seed("organizationMembers", {
      organizationId: "organizations_1",
      userId: `users_${role}`,
      role,
    });
  }
  const purchaseId = db.seed("purchases", {
    projectId: PROJECT,
    store: "google",
    applicationId: "com.example",
    remoteId: TOKEN,
    requestData: { store: "google", purchaseToken: TOKEN },
    remoteResponse: RESPONSE,
    state: "ENTITLED",
    isValid: true,
    productId: "premium",
  }) as Id<"purchases">;
  db.seed("subscriptions", {
    projectId: PROJECT,
    purchaseToken: "2000000000000001",
    productId: "monthly",
    platform: "IOS",
    store: "apple",
    state: "Active",
    startedAt: 0,
    updatedAt: 0,
  });
  db.seed("apiKeys", {
    key: SECRET_KEY,
    keyType: "secret",
    isActive: true,
    projectId: PROJECT,
    organizationId: "organizations_1",
  });
  return { db, purchaseId };
}

const fingerprint = createHash("sha256").update(TOKEN).digest("hex");

describe("raw store evidence", () => {
  it("stays visible to project owners and admins", async () => {
    const { db, purchaseId } = setup();
    for (const role of ["owner", "admin"]) {
      const purchase = await getPurchaseById._handler(
        memoryCtx(db, `users_${role}`),
        { purchaseId },
      );
      expect(purchase).toMatchObject({
        remoteId: TOKEN,
        requestData: { store: "google", purchaseToken: TOKEN },
        remoteResponse: RESPONSE,
        rawEvidenceVisible: true,
        evidenceFingerprint: fingerprint,
      });
    }
  });

  it("is hidden from members: the detail shows a fingerprint, the list omits it", async () => {
    const { db, purchaseId } = setup();
    const ctx = memoryCtx(db, "users_member");

    const purchase = await getPurchaseById._handler(ctx, {
      purchaseId,
    });
    expect(purchase).toMatchObject({
      productId: "premium",
      rawEvidenceVisible: false,
      evidenceFingerprint: fingerprint,
    });
    expect(purchase).not.toHaveProperty("requestData");
    expect(purchase).not.toHaveProperty("remoteResponse");
    expect(purchase).not.toHaveProperty("remoteId");
    expect(JSON.stringify(purchase)).not.toContain(TOKEN);

    const list = await getReceiptsByProject._handler(ctx, {
      projectId: PROJECT,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(list.page).toHaveLength(1);
    expect(list.page[0]).not.toHaveProperty("remoteResponse");
    expect(JSON.stringify(list.page)).not.toContain(TOKEN);

    const adminList = await getReceiptsByProject._handler(
      memoryCtx(db, "users_admin"),
      { projectId: PROJECT, paginationOpts: { numItems: 10, cursor: null } },
    );
    expect(adminList.page[0]).toMatchObject({ remoteId: TOKEN });
  });
});

describe("subscription store tokens", () => {
  it("reach dashboard admins and API keys, never members", async () => {
    const { db } = setup();
    const list = async (userId: string | undefined, args: object) =>
      (
        await listSubscriptions._handler(memoryCtx(db, userId), {
          ...args,
        })
      ).items[0];

    expect(await list("users_admin", { projectId: PROJECT })).toMatchObject({
      purchaseToken: "2000000000000001",
      originalTransactionId: "2000000000000001",
    });
    expect(await list(undefined, { apiKey: SECRET_KEY })).toMatchObject({
      purchaseToken: "2000000000000001",
    });

    const memberRow = await list("users_member", { projectId: PROJECT });
    // The field stays for decoders that require it, empty.
    expect(memberRow).toMatchObject({
      productId: "monthly",
      purchaseToken: "",
    });
    expect(memberRow).not.toHaveProperty("originalTransactionId");
  });
});
