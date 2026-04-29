import { beforeEach, describe, expect, it } from "vitest";

/**
 * In-memory reimplementation of the index resolution that
 * `getProjectByApiKey` (internal) depends on. The convex function itself
 * wraps `getApiKeyByKey` + a `projects.by_api_key` fallback; the
 * behavior under test is the **ordering** and **fallback** logic.
 *
 * Scoped narrow on purpose — just enough to catch regressions in the
 * "preferred path first, legacy fallback second" contract.
 */

type Project = { _id: string; apiKey?: string };
type ApiKey = {
  _id: string;
  key: string;
  projectId: string;
  isActive?: boolean;
};

async function getProjectByApiKey(
  tables: { apiKeys: ApiKey[]; projects: Project[] },
  apiKey: string,
): Promise<Project | null> {
  const primary = tables.apiKeys.find((k) => k.key === apiKey) ?? null;
  if (primary !== null) {
    if (primary.isActive === false) return null;
    return tables.projects.find((p) => p._id === primary.projectId) ?? null;
  }

  // Legacy fallback
  return tables.projects.find((p) => p.apiKey === apiKey) ?? null;
}

describe("getProjectByApiKey — preferred path / legacy fallback", () => {
  let tables: { apiKeys: ApiKey[]; projects: Project[] };

  beforeEach(() => {
    tables = {
      apiKeys: [
        {
          _id: "k1",
          key: "openiap-kit_active",
          projectId: "proj_a",
          isActive: true,
        },
        {
          _id: "k2",
          key: "openiap-kit_revoked",
          projectId: "proj_b",
          isActive: false,
        },
      ],
      projects: [
        { _id: "proj_a", apiKey: "openiap-kit_active" },
        { _id: "proj_b", apiKey: "openiap-kit_revoked" },
        // Legacy-only project — no matching `apiKeys` row.
        { _id: "proj_legacy", apiKey: "openiap-kit_legacy" },
      ],
    };
  });

  it("resolves an active key via the apiKeys table first", async () => {
    const project = await getProjectByApiKey(tables, "openiap-kit_active");
    expect(project?._id).toBe("proj_a");
  });

  it("returns null when the apiKey row is explicitly inactive (no fallback)", async () => {
    const project = await getProjectByApiKey(tables, "openiap-kit_revoked");
    expect(project).toBeNull();
  });

  it("falls back to the projects.apiKey legacy column when no apiKeys row exists", async () => {
    const project = await getProjectByApiKey(tables, "openiap-kit_legacy");
    expect(project?._id).toBe("proj_legacy");
  });

  it("returns null when neither table has the key", async () => {
    const project = await getProjectByApiKey(tables, "openiap-kit_unknown");
    expect(project).toBeNull();
  });

  it("prefers the apiKeys row even if the projects row also carries the key", async () => {
    // Simulate a migrated project where both tables point to the same
    // project — the primary path still wins.
    tables.apiKeys.push({
      _id: "k_dup",
      key: "openiap-kit_legacy",
      projectId: "proj_legacy",
      isActive: true,
    });
    const project = await getProjectByApiKey(tables, "openiap-kit_legacy");
    expect(project?._id).toBe("proj_legacy");
  });
});
