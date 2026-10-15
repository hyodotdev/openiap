// In-memory ctx.db for unit tests. Orders and ranges rows the way Convex does,
// by the schema's index fields and then _creationTime. Not a convex-test
// substitute: it has no transactions, validators or read limits.
// Two dots in the name keep the Convex bundler from treating it as functions.

import { compareValues, type Value } from "convex/values";

import type { TableNames } from "../_generated/dataModel";
import schema from "../schema";

export type Row = Record<string, Value | undefined> & {
  _id: string;
  _creationTime: number;
};

type Operand = Value | undefined | ((row: Row) => Value | undefined);
type Predicate = (row: Row) => boolean;

const read = (operand: Operand, row: Row): Value | undefined =>
  typeof operand === "function" ? operand(row) : operand;

const compare = (
  test: (order: number) => boolean,
): ((left: Operand, right: Operand) => Predicate) => {
  return (left, right) => (row) =>
    test(compareValues(read(left, row), read(right, row)));
};

const filterBuilder = {
  field: (name: string) => (row: Row) => row[name],
  eq: compare((order) => order === 0),
  gte: compare((order) => order >= 0),
  lte: compare((order) => order <= 0),
  and:
    (...operands: Operand[]): Predicate =>
    (row) =>
      operands.every((operand) => read(operand, row) === true),
  or:
    (...operands: Operand[]): Predicate =>
    (row) =>
      operands.some((operand) => read(operand, row) === true),
};

function indexFields(table: TableNames, name: string): string[] {
  if (name === "by_creation_time") return [];
  const index = schema.tables[table][" indexes"]().find(
    (candidate) => candidate.indexDescriptor === name,
  );
  if (!index) throw new Error(`${table} has no index ${name}`);
  return index.fields;
}

type RangeBuilder = Record<
  "eq" | "gt" | "gte" | "lt" | "lte",
  (field: string, value: Value | undefined) => RangeBuilder
>;

class MemoryQuery {
  private fields: string[] = [];
  private predicates: Predicate[] = [];
  private descending = false;

  constructor(
    private table: TableNames,
    private source: Row[],
  ) {}

  withIndex(name: string, range?: (q: RangeBuilder) => unknown): this {
    this.fields = indexFields(this.table, name);
    const bound =
      (test: (order: number) => boolean) =>
      (field: string, value: Value | undefined) => {
        this.predicates.push((row) => test(compareValues(row[field], value)));
        return q;
      };
    const q: RangeBuilder = {
      eq: bound((order) => order === 0),
      gt: bound((order) => order > 0),
      gte: bound((order) => order >= 0),
      lt: bound((order) => order < 0),
      lte: bound((order) => order <= 0),
    };
    range?.(q);
    return this;
  }

  filter(build: (q: typeof filterBuilder) => Operand): this {
    const operand = build(filterBuilder);
    this.predicates.push((row) => read(operand, row) === true);
    return this;
  }

  order(direction: "asc" | "desc"): this {
    this.descending = direction === "desc";
    return this;
  }

  private results(): Row[] {
    const rows = this.source
      .filter((row) => this.predicates.every((matches) => matches(row)))
      .sort((a, b) => {
        for (const field of [...this.fields, "_creationTime"]) {
          const order = compareValues(a[field], b[field]);
          if (order !== 0) return order;
        }
        return 0;
      });
    return this.descending ? rows.reverse() : rows;
  }

  async take(count: number): Promise<Row[]> {
    return this.results().slice(0, count);
  }

  async first(): Promise<Row | null> {
    return this.results()[0] ?? null;
  }

  async unique(): Promise<Row | null> {
    const rows = this.results();
    if (rows.length > 1) throw new Error(`${this.table}: not unique`);
    return rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return this.results();
  }

  async paginate(options: { numItems: number; cursor: string | null }) {
    const rows = this.results();
    const start = options.cursor === null ? 0 : Number(options.cursor);
    const end = Math.min(start + options.numItems, rows.length);
    return {
      page: rows.slice(start, end),
      isDone: end >= rows.length,
      continueCursor: String(end),
    };
  }
}

export class MemoryDb {
  readonly tables = new Map<string, Row[]>();
  private clock = 0;

  rows(table: TableNames): Row[] {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  seed(table: TableNames, fields: Record<string, Value | undefined>): string {
    const _id =
      typeof fields._id === "string"
        ? fields._id
        : `${table}_${this.rows(table).length + 1}_${++this.clock}`;
    this.rows(table).push({ ...fields, _id, _creationTime: ++this.clock });
    return _id;
  }

  query(table: TableNames): MemoryQuery {
    return new MemoryQuery(table, this.rows(table));
  }

  private locate(id: string): { rows: Row[]; index: number } | null {
    for (const rows of this.tables.values()) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) return { rows, index };
    }
    return null;
  }

  async get(id: string): Promise<Row | null> {
    const found = this.locate(id);
    return found ? found.rows[found.index] : null;
  }

  async insert(
    table: TableNames,
    fields: Record<string, Value | undefined>,
  ): Promise<string> {
    return this.seed(table, fields);
  }

  async patch(id: string, fields: Record<string, Value | undefined>) {
    const found = this.locate(id);
    if (!found) throw new Error(`missing row ${id}`);
    const row = found.rows[found.index];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete row[key];
      else row[key] = value;
    }
  }

  async delete(id: string) {
    const found = this.locate(id);
    if (!found) throw new Error(`missing row ${id}`);
    found.rows.splice(found.index, 1);
  }
}

/** A mutation/query ctx over `db`, signed in as `userId` when given. */
export function memoryCtx(db: MemoryDb, userId?: string) {
  return {
    db,
    scheduler: { runAfter: async () => null },
    auth: {
      getUserIdentity: async () =>
        userId
          ? { subject: `${userId}|session`, tokenIdentifier: userId }
          : null,
    },
  };
}
