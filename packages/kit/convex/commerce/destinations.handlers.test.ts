import { beforeEach, describe, expect, it, vi } from "vitest";

const authUser = { id: "users_1" as string | null };
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: async () => authUser.id,
}));

const {
  createHandler,
  listHandler,
  updateHandler,
  rotateSecretHandler,
  removeHandler,
  continueDestinationRemovalHandler,
  pruneExpiredPreviousSecretsHandler,
  resumePendingDestinationRemovalHandler,
} = await import("./destinations");

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class Query {
  constructor(private rows: Row[]) {}
  withIndex(_n: string, cb?: (q: B) => B): Query {
    if (!cb) return this;
    const b = new B();
    cb(b);
    return new Query(this.rows.filter((r) => b.preds.every((p) => p(r))));
  }
  async collect(): Promise<Row[]> {
    return [...this.rows];
  }
  async take(count: number): Promise<Row[]> {
    return this.rows.slice(0, count);
  }
  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }
}
class B {
  preds: Array<(r: Row) => boolean> = [];
  eq(f: string, v: unknown): B {
    this.preds.push((r) => r[f] === v);
    return this;
  }
  gt(f: string, v: unknown): B {
    this.preds.push((r) =>
      v === undefined ? r[f] !== undefined : (r[f] as number) > (v as number),
    );
    return this;
  }
  lte(f: string, v: number): B {
    this.preds.push((r) => (r[f] as number) <= v);
    return this;
  }
}
class Db {
  tables = new Map<string, Row[]>();
  private n = 0;
  rows(t: string): Row[] {
    if (!this.tables.has(t)) this.tables.set(t, []);
    return this.tables.get(t)!;
  }
  query(t: string) {
    return new Query(this.rows(t));
  }
  async insert(t: string, d: Record<string, unknown>): Promise<string> {
    this.n += 1;
    const _id = `${t}_${this.n}`;
    this.rows(t).push({ ...d, _id, _creationTime: Date.now() });
    return _id;
  }
  async get(id: string): Promise<Row | null> {
    for (const rows of this.tables.values()) {
      const hit = rows.find((r) => r._id === id);
      if (hit) return hit;
    }
    return null;
  }
  async patch(id: string, p: Record<string, unknown>): Promise<void> {
    const r = await this.get(id);
    if (r) Object.assign(r, p);
  }
  async delete(id: string): Promise<void> {
    for (const [t, rows] of this.tables) {
      const i = rows.findIndex((r) => r._id === id);
      if (i >= 0) {
        rows.splice(i, 1);
        this.tables.set(t, rows);
        return;
      }
    }
  }
}

const ctxOf = (db: Db) =>
  ({
    db,
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  }) as never;

function seedProject(db: Db, role = "admin") {
  db.rows("organizations").push({
    _id: "orgs_1",
    _creationTime: Date.now(),
  });
  db.rows("projects").push({
    _id: "projects_1",
    _creationTime: Date.now(),
    organizationId: "orgs_1",
  });
  db.rows("organizationMembers").push({
    _id: "members_1",
    _creationTime: Date.now(),
    organizationId: "orgs_1",
    userId: "users_1",
    role,
  });
}

beforeEach(() => {
  authUser.id = "users_1";
});

describe("create", () => {
  it("stores a normalized url and returns the secret once", async () => {
    const db = new Db();
    seedProject(db);
    const result = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://Hooks.Example.com/iapkit",
    });
    expect(result.secret.startsWith("whsec_")).toBe(true);
    const row = db.rows("outboundDestinations")[0];
    expect(row.url).toBe("https://hooks.example.com/iapkit");
    expect(row.enabled).toBe(true);
  });

  it("refuses an unauthenticated caller", async () => {
    const db = new Db();
    seedProject(db);
    authUser.id = null;
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/h",
      }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("refuses a member-role caller", async () => {
    const db = new Db();
    seedProject(db, "member");
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/h",
      }),
    ).rejects.toThrow(/Insufficient permissions/);
  });

  it("refuses new destinations after project deletion begins", async () => {
    const db = new Db();
    seedProject(db);
    await db.patch("projects_1", { pendingDeletion: true });
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/h",
      }),
    ).rejects.toThrow(/Project not found/);
  });

  it("refuses an SSRF-shaped url before it is ever stored", async () => {
    const db = new Db();
    seedProject(db);
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://169.254.169.254/latest",
      }),
    ).rejects.toThrow(/Destination URL rejected/);
    expect(db.rows("outboundDestinations")).toHaveLength(0);
  });

  it("refuses an event type outside the published contract", async () => {
    const db = new Db();
    seedProject(db);
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/h",
        eventTypes: ["subscription.not_real"],
      }),
    ).rejects.toThrow(/Unknown event types/);
  });

  it("caps how many destinations a project may register", async () => {
    const db = new Db();
    seedProject(db);
    for (let i = 0; i < 10; i += 1) {
      await createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: `https://hooks.example.com/h${i}`,
      });
    }
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/overflow",
      }),
    ).rejects.toThrow(/at most/);
  });

  it("gives each destination a distinct secret", async () => {
    const db = new Db();
    seedProject(db);
    const a = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/a",
    });
    const b = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/b",
    });
    expect(a.secret).not.toBe(b.secret);
  });

  it("bounds metadata and canonicalizes event filters", async () => {
    const db = new Db();
    seedProject(db);
    await expect(
      createHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        url: "https://hooks.example.com/h",
        description: "x".repeat(513),
      }),
    ).rejects.toThrow(/at most 512/);
    await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
      eventTypes: ["subscription.renewed", "subscription.renewed"],
    });
    expect(db.rows("outboundDestinations")[0].eventTypes).toEqual([
      "subscription.renewed",
    ]);
  });
});

describe("list", () => {
  it("never returns the secret or its rotation slot", async () => {
    const db = new Db();
    seedProject(db);
    await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await rotateSecretHandler(
      ctxOf(db),
      db.rows("outboundDestinations")[0]._id as never,
    );
    const listed = await listHandler(ctxOf(db), "projects_1" as never);
    expect(JSON.stringify(listed)).not.toContain("whsec_");
    expect(Object.keys(listed[0])).not.toContain("secret");
    expect(Object.keys(listed[0])).not.toContain("previousSecret");
  });
});

describe("update", () => {
  it("clears an event filter when all events are selected", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
      eventTypes: ["subscription.renewed"],
    });

    await updateHandler(ctxOf(db), { destinationId, eventTypes: [] });
    expect((await db.get(destinationId))?.eventTypes).toEqual([]);
  });

  it("rejects an unsafe url without mutating the row", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await expect(
      updateHandler(ctxOf(db), {
        destinationId,
        url: "http://10.0.0.1/h",
      }),
    ).rejects.toThrow(/Destination URL rejected/);
    expect((await db.get(destinationId))?.url).toBe(
      "https://hooks.example.com/h",
    );
  });

  it("clears the breaker when a destination is re-enabled", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await db.patch(destinationId, {
      enabled: false,
      consecutiveFailures: 20,
      disabledReason: "auto-disabled after 20 consecutive failures",
    });
    await updateHandler(ctxOf(db), { destinationId, enabled: true });
    const row = await db.get(destinationId);
    expect(row?.enabled).toBe(true);
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.disabledReason).toBeUndefined();
  });
});

describe("rotateSecret", () => {
  it("keeps the old secret valid for the grace window", async () => {
    const db = new Db();
    seedProject(db);
    const created = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    const rotated = await rotateSecretHandler(ctxOf(db), created.destinationId);
    const row = await db.get(created.destinationId);
    expect(rotated.secret).not.toBe(created.secret);
    expect(row?.secret).toBe(rotated.secret);
    expect(row?.previousSecret).toBe(created.secret);
    expect(row?.previousSecretExpiresAt as number).toBeGreaterThan(Date.now());
  });

  it("rejects another rotation during the active grace window", async () => {
    const db = new Db();
    seedProject(db);
    const created = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await rotateSecretHandler(ctxOf(db), created.destinationId);
    await expect(
      rotateSecretHandler(ctxOf(db), created.destinationId),
    ).rejects.toThrow(/24-hour/);
  });
});

describe("remove", () => {
  it("drops queued deliveries so the worker cannot claim an orphan", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await db.insert("outboundDeliveries", {
      projectId: "projects_1",
      eventId: "commerceEvents_1",
      destinationId,
      status: "pending",
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await removeHandler(ctxOf(db), destinationId);
    expect(db.rows("outboundDeliveries")).toHaveLength(0);
    expect(db.rows("outboundDestinations")).toHaveLength(0);
  });

  it("drains large delivery history in bounded continuations", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    for (let index = 0; index < 101; index += 1) {
      await db.insert("outboundDeliveries", {
        destinationId,
        status: "delivered",
      });
    }
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };
    const ctx = { db, scheduler } as never;

    await removeHandler(ctx, destinationId);
    expect(db.rows("outboundDeliveries")).toHaveLength(1);
    expect(db.rows("outboundDestinations")[0]).toMatchObject({
      enabled: false,
      pendingDeletion: true,
    });
    expect(scheduler.runAfter).toHaveBeenCalledTimes(1);

    await continueDestinationRemovalHandler(ctx, destinationId);
    expect(db.rows("outboundDeliveries")).toHaveLength(0);
    expect(db.rows("outboundDestinations")).toHaveLength(0);
  });

  it("resumes a pending deletion when an earlier continuation was lost", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await db.patch(destinationId, { enabled: false, pendingDeletion: true });
    await expect(removeHandler(ctxOf(db), destinationId)).resolves.toBeNull();
    expect(db.rows("outboundDestinations")).toHaveLength(0);
  });

  it("refuses to remove a destination the caller does not administer", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    authUser.id = "users_intruder";
    await expect(removeHandler(ctxOf(db), destinationId)).rejects.toThrow(
      /Insufficient permissions/,
    );
    expect(db.rows("outboundDestinations")).toHaveLength(1);
  });
});

describe("rotation cleanup", () => {
  it("erases rotated-out secrets after grace expires", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await db.patch(destinationId, {
      previousSecret: "whsec_old",
      previousSecretExpiresAt: Date.now() - 1,
    });
    await expect(pruneExpiredPreviousSecretsHandler(ctxOf(db))).resolves.toBe(
      1,
    );
    expect(await db.get(destinationId)).toMatchObject({
      previousSecret: undefined,
      previousSecretExpiresAt: undefined,
    });
  });
});

describe("deletion recovery", () => {
  it("resumes a destination left pending by a lost continuation", async () => {
    const db = new Db();
    seedProject(db);
    const { destinationId } = await createHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      url: "https://hooks.example.com/h",
    });
    await db.patch(destinationId, { enabled: false, pendingDeletion: true });

    await expect(
      resumePendingDestinationRemovalHandler(ctxOf(db)),
    ).resolves.toBe(destinationId);
    expect(db.rows("outboundDestinations")).toHaveLength(0);
  });
});
