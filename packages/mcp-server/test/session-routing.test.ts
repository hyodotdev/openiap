import { describe, expect, it } from "vitest";

import {
  buildSessionId,
  currentMachineId,
  routeUnknownSession,
} from "../src/session-routing";

describe("currentMachineId", () => {
  it("reads a well-formed FLY_MACHINE_ID", () => {
    expect(currentMachineId({ FLY_MACHINE_ID: "17811953c25489" })).toBe(
      "17811953c25489",
    );
  });

  it("returns undefined off Fly or for malformed ids", () => {
    expect(currentMachineId({})).toBeUndefined();
    expect(currentMachineId({ FLY_MACHINE_ID: "" })).toBeUndefined();
    expect(currentMachineId({ FLY_MACHINE_ID: "bad.value" })).toBeUndefined();
    expect(currentMachineId({ FLY_MACHINE_ID: "a".repeat(33) })).toBeUndefined();
  });
});

describe("buildSessionId", () => {
  it("prefixes the machine id when present", () => {
    expect(buildSessionId("m1", "uuid-1")).toBe("m1.uuid-1");
  });

  it("returns the bare uuid off Fly", () => {
    expect(buildSessionId(undefined, "uuid-1")).toBe("uuid-1");
  });
});

describe("routeUnknownSession", () => {
  it("replays to the machine that minted the session id", () => {
    expect(
      routeUnknownSession({
        sessionId: "other77.uuid-1",
        machineId: "self42",
        alreadyReplayed: false,
      }),
    ).toEqual({ action: "replay", targetMachineId: "other77" });
  });

  it("never replays a request that was already replayed once", () => {
    expect(
      routeUnknownSession({
        sessionId: "other77.uuid-1",
        machineId: "self42",
        alreadyReplayed: true,
      }),
    ).toEqual({ action: "not-found" });
  });

  it("never replays to itself (map lost to a restart)", () => {
    expect(
      routeUnknownSession({
        sessionId: "self42.uuid-1",
        machineId: "self42",
        alreadyReplayed: false,
      }),
    ).toEqual({ action: "not-found" });
  });

  it("does not replay off Fly", () => {
    expect(
      routeUnknownSession({
        sessionId: "other77.uuid-1",
        machineId: undefined,
        alreadyReplayed: false,
      }),
    ).toEqual({ action: "not-found" });
  });

  it("rejects unprefixed or malformed session ids", () => {
    for (const sessionId of [
      "plain-uuid-without-prefix",
      ".uuid-1",
      "bad prefix.uuid-1",
      `${"a".repeat(33)}.uuid-1`,
      "inject=1\r\n.uuid-1",
    ]) {
      expect(
        routeUnknownSession({
          sessionId,
          machineId: "self42",
          alreadyReplayed: false,
        }),
      ).toEqual({ action: "not-found" });
    }
  });
});
