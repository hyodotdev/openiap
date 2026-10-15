import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { Id } from "../_generated/dataModel";
import { MemoryDb, memoryCtx } from "../purchaseIssues/memoryDb.testing";
import { testableFunction } from "../test.setup";
import {
  getPurchaseById as registeredGetPurchaseById,
  getReceiptsByProject as registeredGetReceiptsByProject,
} from "./query";

const getPurchaseById = testableFunction(registeredGetPurchaseById);
const getReceiptsByProject = testableFunction(registeredGetReceiptsByProject);
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

  it("is replaced by a fingerprint for members, in the detail and the list", async () => {
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
