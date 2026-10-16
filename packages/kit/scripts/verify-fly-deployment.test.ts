import { describe, expect, it, vi } from "vitest";
import { verifyFlyDeployment } from "./verify-fly-deployment";

const revision = "a".repeat(40);
const machine = {
  id: "7849e073a91568",
  state: "started",
  instance_id: "config-1",
};
const health = {
  ok: true,
  service: "iapkit",
  environment: "production",
  revision: revision.slice(0, 12),
  instanceId: machine.id,
  verificationSourceReady: true,
};

function fixture() {
  let time = 0;
  return {
    listMachines: vi.fn<() => Promise<unknown>>().mockResolvedValue([machine]),
    probe: vi.fn<(id: string) => Promise<unknown>>().mockResolvedValue(health),
    now: () => time,
    wait: async () => {
      time += 10;
    },
  };
}

describe("Fly fleet deployment gate", () => {
  it("probes each machine and confirms the same configuration inventory afterwards", async () => {
    const checks = fixture();
    const second = { ...machine, id: "e7849e073a9156" };
    checks.listMachines.mockResolvedValue([machine, second]);
    checks.probe.mockImplementation(async (id) => ({
      ...health,
      instanceId: id,
    }));
    expect(await verifyFlyDeployment(revision, checks)).toBe(2);
    expect(checks.listMachines).toHaveBeenCalledTimes(2);
    expect(checks.probe.mock.calls).toEqual([[second.id], [machine.id]].sort());
  });

  it.each([
    ["old revision", { ...health, revision: "b".repeat(12) }],
    [
      "fallback routing to another instance",
      { ...health, instanceId: "e7849e073a9156" },
    ],
    [
      "missing runtime credential",
      { ...health, verificationSourceReady: false },
    ],
    ["wrong environment", { ...health, environment: "development" }],
    ["invalid health response", null],
  ])("rejects %s", async (_label, response) => {
    const checks = fixture();
    checks.probe.mockResolvedValue(response);
    await expect(verifyFlyDeployment(revision, checks, 20)).rejects.toThrow(
      "Fly fleet verification failed",
    );
  });

  it.each([
    [],
    [machine, { ...machine, id: "e7849e073a9156", state: "stopped" }],
    [machine, machine],
    [{}],
  ])(
    "rejects empty, retained stopped, duplicate or incomplete inventories %#",
    async (...machines) => {
      const checks = fixture();
      checks.listMachines.mockResolvedValue(machines);
      await expect(verifyFlyDeployment(revision, checks, 20)).rejects.toThrow();
    },
  );

  it("does not accept an old extra instance in a partial rollout", async () => {
    const checks = fixture();
    checks.listMachines.mockResolvedValue([
      machine,
      { ...machine, id: "e7849e073a9156" },
    ]);
    checks.probe.mockImplementation(async (id) => ({
      ...health,
      instanceId: id,
      revision: id === machine.id ? health.revision : "b".repeat(12),
    }));
    await expect(verifyFlyDeployment(revision, checks, 20)).rejects.toThrow();
  });

  it("retries a fleet/configuration change and verifies the replacement", async () => {
    const checks = fixture();
    const replacement = { ...machine, instance_id: "config-2" };
    checks.listMachines
      .mockResolvedValueOnce([machine])
      .mockResolvedValue([replacement]);
    expect(await verifyFlyDeployment(revision, checks)).toBe(1);
    expect(checks.listMachines).toHaveBeenCalledTimes(4);
    expect(checks.probe).toHaveBeenCalledTimes(2);
  });

  it("bounds retries when an instance or inventory is unavailable", async () => {
    for (const failure of ["listMachines", "probe"] as const) {
      const checks = fixture();
      checks[failure].mockRejectedValue(
        new Error("private provider diagnostic"),
      );
      await expect(verifyFlyDeployment(revision, checks, 20)).rejects.toThrow(
        "Fly fleet verification failed",
      );
      expect(checks[failure]).toHaveBeenCalledTimes(2);
    }
  });
});
