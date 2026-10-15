// In-memory stand-in for the slice of `ctx.db` the operations handlers use.
// Not deployed: Convex skips module names with more than one dot.
// Index ranges and `.filter()` are evaluated per row; rows are ordered by the
// index's fields when listed below, otherwise by insertion.

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type Expr = (row: Row) => unknown;

const INDEX_FIELDS: Record<string, string[]> = {
  by_project_and_status_and_updated: ["projectId", "status", "updatedAt"],
  by_project_and_last_resend: ["projectId", "lastResendAt"],
  by_project_and_received: ["projectId", "receivedAt"],
  by_project_and_user_and_updated: ["projectId", "userId", "updatedAt"],
  by_project_and_appUserId_and_lastSeenAt: [
    "projectId",
    "appUserId",
    "lastSeenAt",
  ],
};

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return (a as number) < (b as number) ? -1 : 1;
}

class RangeBuilder {
  predicates: Array<(row: Row) => boolean> = [];
  eq(field: string, value: unknown): this {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
  gt(field: string, value: unknown): this {
    this.predicates.push(
      (row) => row[field] !== undefined && compare(row[field], value) > 0,
    );
    return this;
  }
  gte(field: string, value: unknown): this {
    this.predicates.push(
      (row) => row[field] !== undefined && compare(row[field], value) >= 0,
    );
    return this;
  }
  lt(field: string, value: unknown): this {
    this.predicates.push((row) => compare(row[field], value) < 0);
    return this;
  }
  lte(field: string, value: unknown): this {
    this.predicates.push((row) => compare(row[field], value) <= 0);
    return this;
  }
}

const filterBuilder = {
  field:
    (name: string): Expr =>
    (row) =>
      row[name],
  eq:
    (a: unknown, b: unknown): Expr =>
    (row) =>
      resolve(a, row) === resolve(b, row),
  gte:
    (a: Expr, b: unknown): Expr =>
    (row) =>
      compare(resolve(a, row), resolve(b, row)) >= 0,
  lte:
    (a: Expr, b: unknown): Expr =>
    (row) =>
      compare(resolve(a, row), resolve(b, row)) <= 0,
  and:
    (...parts: Array<Expr | boolean>): Expr =>
    (row) =>
      parts.every((part) => Boolean(resolve(part, row))),
};

function resolve(value: unknown, row: Row): unknown {
  return typeof value === "function" ? (value as Expr)(row) : value;
}

class FakeQuery {
  constructor(private rows: Row[]) {}

  withIndex(
    name: string,
    range?: (q: RangeBuilder) => RangeBuilder,
  ): FakeQuery {
    const builder = new RangeBuilder();
    range?.(builder);
    const fields = INDEX_FIELDS[name];
    const matched = this.rows.filter((row) =>
      builder.predicates.every((predicate) => predicate(row)),
    );
    if (fields) {
      matched.sort((a, b) => {
        for (const field of [...fields, "_creationTime"]) {
          const order = compare(a[field], b[field]);
          if (order !== 0) return order;
        }
        return 0;
      });
    }
    return new FakeQuery(matched);
  }

  order(direction: "asc" | "desc"): FakeQuery {
    return new FakeQuery(
      direction === "desc" ? [...this.rows].reverse() : [...this.rows],
    );
  }

  filter(build: (q: typeof filterBuilder) => unknown): FakeQuery {
    const expr = build(filterBuilder);
    return new FakeQuery(this.rows.filter((row) => resolve(expr, row)));
  }

  async take(count: number): Promise<Row[]> {
    return this.rows.slice(0, count).map(copy);
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ? copy(this.rows[0]) : null;
  }

  async unique(): Promise<Row | null> {
    if (this.rows.length > 1) throw new Error("unique() matched several rows");
    return this.first();
  }

  async collect(): Promise<Row[]> {
    return this.rows.map(copy);
  }

  async paginate(options: { numItems: number; cursor: string | null }) {
    const start = options.cursor ? Number(options.cursor) : 0;
    const end = Math.min(start + options.numItems, this.rows.length);
    return {
      page: this.rows.slice(start, end).map(copy),
      isDone: end >= this.rows.length,
      continueCursor: String(end),
    };
  }
}

/** Reads return snapshots, as Convex does, so later writes cannot leak back. */
function copy(row: Row): Row {
  return structuredClone(row);
}

export class FakeDb {
  private tables = new Map<string, Row[]>();
  private counter = 0;

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  query(table: string): FakeQuery {
    return new FakeQuery(this.rows(table));
  }

  normalizeId(table: string, id: string): string | null {
    return id.startsWith(`${table}_`) ? id : null;
  }

  async insert(table: string, doc: Record<string, unknown>): Promise<string> {
    this.counter += 1;
    const _id = `${table}_${this.counter}`;
    this.rows(table).push({ ...doc, _id, _creationTime: this.counter });
    return _id;
  }

  async get(id: string): Promise<Row | null> {
    const row = this.stored(id);
    return row ? copy(row) : null;
  }

  private stored(id: string): Row | undefined {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return undefined;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<void> {
    const row = this.stored(id);
    if (!row) throw new Error(`patch: ${id} not found`);
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete row[key];
      else row[key] = value;
    }
  }

  async delete(id: string): Promise<void> {
    for (const rows of this.tables.values()) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
  }
}

/** A project in an organization where `users_1` holds `role`. */
export function seedProject(db: FakeDb, role: "owner" | "admin" | "member") {
  db.rows("organizations").push({ _id: "organizations_1", _creationTime: 0 });
  db.rows("projects").push({
    _id: "projects_1",
    _creationTime: 0,
    organizationId: "organizations_1",
  });
  db.rows("organizationMembers").push({
    _id: "organizationMembers_1",
    _creationTime: 0,
    organizationId: "organizations_1",
    userId: "users_1",
    role,
  });
}
