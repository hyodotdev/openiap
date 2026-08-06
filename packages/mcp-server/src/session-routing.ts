// MCP session ids are held in per-process memory (the transport object
// itself is stateful — an SSE stream can't be serialized into a shared
// store), so a session created on one Fly machine is invisible to its
// siblings. Fix (GitHub issue #287): embed the creating machine's id in
// the session id, and when a request lands on the wrong machine, answer
// with a `fly-replay` header so Fly's proxy re-routes the original
// request to the owner. Off Fly (no FLY_MACHINE_ID) session ids stay
// plain UUIDs and routing always resolves to `not-found`.

/**
 * Fly machine ids are lowercase hex today, but only shape-check them:
 * the prefix is attacker-controlled (it arrives inside the client's
 * `mcp-session-id` header), so the pattern also guards the value we
 * echo back inside the `fly-replay` response header.
 */
const MACHINE_ID_PATTERN = /^[A-Za-z0-9]{1,32}$/;

const SESSION_MACHINE_SEPARATOR = ".";

/** Reads the Fly machine identity, or undefined when not running on Fly. */
export function currentMachineId(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env.FLY_MACHINE_ID;
  return raw && MACHINE_ID_PATTERN.test(raw) ? raw : undefined;
}

/** Builds a session id that carries the creating machine's identity. */
export function buildSessionId(
  machineId: string | undefined,
  uuid: string,
): string {
  return machineId ? `${machineId}${SESSION_MACHINE_SEPARATOR}${uuid}` : uuid;
}

/** Routing decision for a session id this process doesn't recognize. */
export type UnknownSessionRouting =
  { action: "replay"; targetMachineId: string } | { action: "not-found" };

/**
 * Decides what to do with a session id that isn't in the local
 * transport map.
 *
 * @param options.sessionId Session id from the `mcp-session-id` header.
 * @param options.machineId This process's machine id (undefined off Fly).
 * @param options.alreadyReplayed True when the request carries
 *   `fly-replay-src`, i.e. it was already replayed once — never replay
 *   again or two stale machines could bounce a request forever.
 * @returns `replay` toward the owning machine, or `not-found` (the
 *   caller answers 404 so the client re-initializes per the MCP spec).
 */
export function routeUnknownSession(options: {
  sessionId: string;
  machineId: string | undefined;
  alreadyReplayed: boolean;
}): UnknownSessionRouting {
  if (!options.machineId || options.alreadyReplayed) {
    return { action: "not-found" };
  }

  const separatorIndex = options.sessionId.indexOf(SESSION_MACHINE_SEPARATOR);
  if (separatorIndex <= 0) return { action: "not-found" };

  const prefix = options.sessionId.slice(0, separatorIndex);
  if (!MACHINE_ID_PATTERN.test(prefix) || prefix === options.machineId) {
    // Malformed prefix, or the session was minted by this very machine
    // (map lost to a restart/deploy) — replaying to ourselves would loop.
    return { action: "not-found" };
  }

  return { action: "replay", targetMachineId: prefix };
}
