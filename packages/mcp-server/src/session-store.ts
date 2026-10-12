import { createHash } from "node:crypto";

interface SessionEntry<T> {
  value: T;
  lastAccessedAt: number;
  owner?: string;
}

const MAX_MCP_SESSIONS = 256;
const MAX_MCP_SESSIONS_PER_KEY = 16;
const MCP_SESSION_IDLE_TTL_MS = 15 * 60 * 1000;
export const MCP_SESSION_CAPACITY_RETRY_AFTER_SECONDS = 5;
export const MCP_SESSION_CAPACITY_MESSAGE =
  "MCP session capacity reached. Retry after 5s.";

interface ClosableSession {
  close: () => void | Promise<void>;
}

export interface BoundedSessionStoreOptions<T> {
  maxSize: number;
  /** Sessions one owner (API key) may hold; its oldest goes first. */
  maxPerOwner?: number;
  idleTtlMs: number;
  dispose: (value: T) => void | Promise<void>;
  now?: () => number;
  onDisposeError?: (error: unknown) => void;
}

export interface SessionReservation<T> {
  commit: (sessionId: string, value: T) => void;
  release: () => void;
}

export class BoundedSessionStore<T> {
  private readonly entries = new Map<string, SessionEntry<T>>();
  private readonly now: () => number;
  private pendingReservations = 0;
  private readonly pendingByOwner = new Map<string, number>();
  private reservationGeneration = 0;
  private closed = false;

  constructor(private readonly options: BoundedSessionStoreOptions<T>) {
    if (!Number.isSafeInteger(options.maxSize) || options.maxSize < 1) {
      throw new Error("session maxSize must be a positive integer");
    }
    if (!Number.isFinite(options.idleTtlMs) || options.idleTtlMs <= 0) {
      throw new Error("session idleTtlMs must be positive");
    }
    this.now = options.now ?? (() => Date.now());
  }

  get size(): number {
    return this.entries.size;
  }

  get(sessionId: string): T | undefined {
    const now = this.now();
    this.pruneExpired(now);
    const entry = this.entries.get(sessionId);
    if (!entry) return undefined;

    this.entries.delete(sessionId);
    this.entries.set(sessionId, { ...entry, lastAccessedAt: now });
    return entry.value;
  }

  reserve(owner?: string): SessionReservation<T> | null {
    if (this.closed) return null;

    const now = this.now();
    this.pruneExpired(now);
    // A key over its share, in-flight reservations included, loses its own
    // oldest session, or is refused while all its slots are in flight, so one
    // key holder cannot push other tenants out.
    const owned = owner ? this.sessionIdsOf(owner) : [];
    const ownerPending = owner ? (this.pendingByOwner.get(owner) ?? 0) : 0;
    if (owned.length + ownerPending >= (this.options.maxPerOwner ?? Infinity)) {
      if (owned.length === 0) return null;
      this.evict(owned[0]);
    }
    // When full, evict the least recently used session rather than refuse: its
    // client gets a 404 and re-initializes. Only a store full of in-flight
    // reservations refuses.
    if (this.entries.size + this.pendingReservations >= this.options.maxSize) {
      const oldestSessionId = this.entries.keys().next().value;
      if (oldestSessionId === undefined) return null;
      this.evict(oldestSessionId);
    }

    this.pendingReservations += 1;
    if (owner) this.pendingByOwner.set(owner, ownerPending + 1);
    const generation = this.reservationGeneration;
    let pending = true;
    const release = (): void => {
      if (!pending) return;
      pending = false;
      if (generation === this.reservationGeneration) {
        this.pendingReservations -= 1;
        if (owner) {
          const remaining = (this.pendingByOwner.get(owner) ?? 1) - 1;
          if (remaining > 0) this.pendingByOwner.set(owner, remaining);
          else this.pendingByOwner.delete(owner);
        }
      }
    };

    return {
      commit: (sessionId, value) => {
        if (
          !pending ||
          this.closed ||
          generation !== this.reservationGeneration
        ) {
          pending = false;
          throw new Error("session reservation is no longer active");
        }
        release();
        const previous = this.entries.get(sessionId);
        this.entries.delete(sessionId);
        if (previous && previous.value !== value) {
          void this.dispose(previous.value);
        }
        this.entries.set(sessionId, {
          value,
          lastAccessedAt: this.now(),
          owner,
        });
      },
      release,
    };
  }

  delete(sessionId: string): boolean {
    // Transport close callbacks own disposal; this only forgets the closed entry.
    return this.entries.delete(sessionId);
  }

  pruneExpired(now: number = this.now()): void {
    while (this.entries.size > 0) {
      const oldestSessionId = this.entries.keys().next().value;
      if (oldestSessionId === undefined) return;
      const oldest = this.entries.get(oldestSessionId);
      if (oldest && now - oldest.lastAccessedAt < this.options.idleTtlMs) {
        return;
      }
      this.evict(oldestSessionId);
    }
  }

  // Least recently used first, the Map's order.
  private sessionIdsOf(owner: string): string[] {
    return Array.from(this.entries)
      .filter(([, entry]) => entry.owner === owner)
      .map(([sessionId]) => sessionId);
  }

  async closeAll(): Promise<void> {
    this.closed = true;
    this.reservationGeneration += 1;
    this.pendingReservations = 0;
    this.pendingByOwner.clear();
    const values = Array.from(this.entries.values(), (entry) => entry.value);
    this.entries.clear();
    await Promise.all(values.map((value) => this.dispose(value)));
  }

  private evict(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    this.entries.delete(sessionId);
    void this.dispose(entry.value);
  }

  private async dispose(value: T): Promise<void> {
    try {
      await this.options.dispose(value);
    } catch (error) {
      this.options.onDisposeError?.(error);
    }
  }
}

/** Groups sessions by key without keeping the raw key in the store. */
export function sessionOwner(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function createMcpSessionStore<T extends ClosableSession>(
  logger: Pick<Console, "error">,
): BoundedSessionStore<T> {
  return new BoundedSessionStore<T>({
    maxSize: MAX_MCP_SESSIONS,
    maxPerOwner: MAX_MCP_SESSIONS_PER_KEY,
    idleTtlMs: MCP_SESSION_IDLE_TTL_MS,
    dispose: (transport) => transport.close(),
    onDisposeError: (error) =>
      logger.error("IAPKit MCP session cleanup failed:", error),
  });
}
