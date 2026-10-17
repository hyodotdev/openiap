import type { Context } from "hono";
import { verificationSourceConfigured } from "../convex/purchases/verificationSource";

const DEPLOYMENT_ENVIRONMENTS = new Set([
  "development",
  "test",
  "staging",
  "production",
]);
const GIT_REVISION_PATTERN = /^[0-9a-f]{7,64}$/i;

type HealthEnvironment = Record<string, string | undefined>;

export interface HealthPayload {
  ok: true;
  status: "healthy";
  service: "iapkit";
  apiVersion: "v1";
  revision: string | null;
  instanceId: string | null;
  verificationSourceReady: boolean;
  environment: string;
  timestamp: string;
}

function deploymentEnvironment(environment: HealthEnvironment): string {
  const value = environment.APP_ENV ?? environment.NODE_ENV;
  return value && DEPLOYMENT_ENVIRONMENTS.has(value) ? value : "development";
}

function deploymentRevision(environment: HealthEnvironment): string | null {
  const value = environment.IAPKIT_REVISION?.trim();
  return value && GIT_REVISION_PATTERN.test(value)
    ? value.slice(0, 12).toLowerCase()
    : null;
}

export function createHealthPayload(
  environment: HealthEnvironment = process.env,
  now = new Date(),
): HealthPayload {
  const instanceId = environment.FLY_MACHINE_ID;
  return {
    ok: true,
    status: "healthy",
    service: "iapkit",
    apiVersion: "v1",
    revision: deploymentRevision(environment),
    instanceId:
      instanceId && /^[a-f0-9]{8,32}$/.test(instanceId) ? instanceId : null,
    verificationSourceReady: verificationSourceConfigured(
      environment.IAPKIT_VERIFICATION_SOURCE_SECRET,
    ),
    environment: deploymentEnvironment(environment),
    timestamp: now.toISOString(),
  };
}

export function handleHealthRequest(c: Context): Response {
  c.header("Cache-Control", "no-store");
  return c.json(createHealthPayload());
}
