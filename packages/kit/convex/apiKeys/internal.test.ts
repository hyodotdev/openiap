import { beforeEach, describe, expect, it, vi } from "vitest";

const apiKeyMocks = vi.hoisted(() => ({ getApiKeyByKey: vi.fn() }));

vi.mock("./helpers", () => ({
  getApiKeyByKey: apiKeyMocks.getApiKeyByKey,
}));

import { validateApiKey as registeredValidateApiKey } from "./internal";
import { testableFunction } from "../test.setup";

const validateApiKey = testableFunction(registeredValidateApiKey);

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class TestQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (q: IndexBuilder) => IndexBuilder) {
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) => builder.predicates.every((test) => test(row))),
    );
  }

  async first() {
    return this.rows[0] ?? null;
  }
}

class TestDb {
  constructor(private readonly tables: Record<string, Row[]>) {}

  async get(id: string) {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string) {
    return new TestQuery(this.tables[table] ?? []);
  }
}

describe("validateApiKey pending-deletion guard", () => {
  beforeEach(() => apiKeyMocks.getApiKeyByKey.mockReset());

  it("rejects a current key when its owning organization is draining", async () => {
    apiKeyMocks.getApiKeyByKey.mockResolvedValue({
      _id: "api_key_a",
      projectId: "projects_a",
      organizationId: "organizations_a",
      isActive: true,
    });
    const db = new TestDb({
      projects: [{ _id: "projects_a", organizationId: "organizations_a" }],
      organizations: [{ _id: "organizations_a", pendingDeletion: true }],
    });

    await expect(
      validateApiKey._handler({ db }, { apiKey: "current-key" }),
    ).resolves.toEqual({
      isValid: false,
      reason: "Associated project not found",
    });
  });

  it("rejects a legacy key when its owning organization is draining", async () => {
    apiKeyMocks.getApiKeyByKey.mockResolvedValue(null);
    const db = new TestDb({
      projects: [
        {
          _id: "projects_a",
          organizationId: "organizations_a",
          apiKey: "legacy-key",
        },
      ],
      organizations: [{ _id: "organizations_a", pendingDeletion: true }],
    });

    await expect(
      validateApiKey._handler({ db }, { apiKey: "legacy-key" }),
    ).resolves.toEqual({ isValid: false });
  });
});
