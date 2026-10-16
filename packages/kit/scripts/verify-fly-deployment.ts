import { execFile } from "node:child_process";
import { promisify } from "node:util";

interface Machine {
  id: string;
  state: string;
  instance_id: string;
}

interface DeploymentChecks {
  listMachines(): Promise<unknown>;
  probe(instanceId: string): Promise<unknown>;
  now(): number;
  wait(): Promise<void>;
}

function fleet(value: unknown): Machine[] {
  if (!Array.isArray(value)) throw new Error("Invalid Fly machine inventory.");
  const machines: Machine[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null)
      throw new Error("Invalid Fly machine inventory.");
    const machine = item as Record<string, unknown>;
    if (machine.state === "destroyed") continue;
    if (
      typeof machine.id !== "string" ||
      !/^[a-f0-9]{8,32}$/.test(machine.id) ||
      typeof machine.state !== "string" ||
      typeof machine.instance_id !== "string" ||
      !machine.instance_id
    )
      throw new Error("Incomplete Fly machine inventory.");
    machines.push({
      id: machine.id,
      state: machine.state,
      instance_id: machine.instance_id,
    });
  }
  if (
    !machines.length ||
    new Set(machines.map((m) => m.id)).size !== machines.length
  )
    throw new Error("Empty or duplicate Fly machine inventory.");
  return machines.sort((a, b) => a.id.localeCompare(b.id));
}

function healthy(value: unknown, machine: Machine, revision: string): boolean {
  if (typeof value !== "object" || value === null) return false;
  const health = value as Record<string, unknown>;
  return (
    health.ok === true &&
    health.service === "iapkit" &&
    health.environment === "production" &&
    health.revision === revision &&
    health.instanceId === machine.id &&
    health.verificationSourceReady === true
  );
}

export async function verifyFlyDeployment(
  revision: string,
  checks: DeploymentChecks,
  timeoutMs = 180_000,
): Promise<number> {
  if (!/^[a-f0-9]{40}$/i.test(revision))
    throw new Error("A full Git revision is required.");
  const expected = revision.slice(0, 12).toLowerCase();
  const deadline = checks.now() + timeoutMs;
  do {
    try {
      const before = fleet(await checks.listMachines());
      if (before.some((machine) => machine.state !== "started"))
        throw new Error("A retained Fly machine is not serving.");
      const results = await Promise.all(
        before.map(async (machine) =>
          healthy(await checks.probe(machine.id), machine, expected),
        ),
      );
      if (results.some((result) => !result))
        throw new Error("A Fly machine has not completed the deployment.");
      const after = fleet(await checks.listMachines());
      if (JSON.stringify(before) !== JSON.stringify(after))
        throw new Error("Fly inventory changed during verification.");
      return before.length;
    } catch {
      if (checks.now() >= deadline) break;
      await checks.wait();
    }
  } while (checks.now() < deadline);
  throw new Error(
    "Fly fleet verification failed; inspect the rollout before retrying or rolling back.",
  );
}

if (import.meta.main) {
  const run = promisify(execFile);
  try {
    const count = await verifyFlyDeployment(process.argv[2] ?? "", {
      async listMachines() {
        const { stdout } = await run(
          "flyctl",
          ["machine", "list", "--app", "openiap-kit", "--json"],
          { timeout: 20_000, maxBuffer: 2_000_000 },
        );
        return JSON.parse(stdout) as unknown;
      },
      async probe(instanceId) {
        const response = await fetch("https://kit.openiap.dev/health", {
          headers: { "Fly-force-instance-id": instanceId },
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Fly health request failed.");
        return response.json() as Promise<unknown>;
      },
      now: Date.now,
      wait: () => new Promise((resolve) => setTimeout(resolve, 5_000)),
    });
    console.log(
      `Verified ${count} Fly machines at ${process.argv[2].slice(0, 12)} with the verification source configured.`,
    );
  } catch {
    console.error(
      "Fly fleet verification failed. Check machine health and revision; no automatic rollback was attempted.",
    );
    process.exitCode = 1;
  }
}
