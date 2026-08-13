interface SessionEntry<T> {
  value: T;
  lastAccessedAt: number;
}

const MAX_MCP_SESSIONS = 256;
const MCP_SESSION_IDLE_TTL_MS = 15 * 60 * 1000;
export const MCP_SESSION_CAPACITY_RETRY_AFTER_SECONDS = 5;
export const MCP_SESSION_CAPACITY_MESSAGE =
  "MCP session capacity reached. Retry after 5s.";

interface ClosableSession {
  close: () => void | Promise<void>;
}

export interface BoundedSessionStoreOptions<T> {
  maxSize: number;
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
    this.entries.set(sessionId, { value: entry.value, lastAccessedAt: now });
    return entry.value;
  }

  reserve(): SessionReservation<T> | null {
    if (this.closed) return null;

    const now = this.now();
    this.pruneExpired(now);
    if (this.entries.size + this.pendingReservations >= this.options.maxSize) {
      return null;
    }

    this.pendingReservations += 1;
    const generation = this.reservationGeneration;
    let pending = true;
    const release = (): void => {
      if (!pending) return;
      pending = false;
      if (generation === this.reservationGeneration) {
        this.pendingReservations -= 1;
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

  async closeAll(): Promise<void> {
    this.closed = true;
    this.reservationGeneration += 1;
    this.pendingReservations = 0;
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

export function createMcpSessionStore<T extends ClosableSession>(
  logger: Pick<Console, "error">,
): BoundedSessionStore<T> {
  return new BoundedSessionStore<T>({
    maxSize: MAX_MCP_SESSIONS,
    idleTtlMs: MCP_SESSION_IDLE_TTL_MS,
    dispose: (transport) => transport.close(),
    onDisposeError: (error) =>
      logger.error("IAPKit MCP session cleanup failed:", error),
  });
}
