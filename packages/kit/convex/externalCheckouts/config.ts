import type { Doc } from "../_generated/dataModel";
import { fail } from "./model";

export interface Integration {
  id: string;
  projectId: string;
  accountId: string;
  environment: "sandbox" | "production";
  apiKey: string;
  signingSecret: string;
}

export interface Profile {
  id: string;
  integrationId: string;
  store: "apple" | "google";
  regions: string[];
  appId: string;
  administrativeArea?: string;
}

function config(): { integrations: Integration[]; profiles: Profile[] } {
  const raw = process.env.IAPKIT_EXTERNAL_CHECKOUTS_CONFIG;
  return raw ? JSON.parse(raw) : { integrations: [], profiles: [] };
}

export function findIntegration(id: string): Integration | undefined {
  return config().integrations.find((item) => item.id === id);
}

export function requireProfile(
  profileId: string,
  project: Doc<"projects">,
  store: Profile["store"],
): { profile: Profile; integration: Integration } {
  const { integrations, profiles } = config();
  const profile = profiles.find(
    (item) => item.id === profileId && item.store === store,
  );
  const integration =
    profile && integrations.find((item) => item.id === profile.integrationId);
  if (
    !profile ||
    !integration ||
    integration.projectId !== project._id ||
    !profile.appId ||
    profile.appId !==
      (store === "apple" ? project.iosBundleId : project.androidPackageName)
  )
    fail("NOT_FOUND", "Reporting profile not found");
  return { profile, integration };
}

export function appleNotificationProfile(
  project: Doc<"projects">,
  environment: Integration["environment"],
): Profile | undefined {
  const { integrations, profiles } = config();
  return profiles.find(
    (item) =>
      item.store === "apple" &&
      item.appId === project.iosBundleId &&
      integrations.some(
        (integration) =>
          integration.id === item.integrationId &&
          integration.projectId === project._id &&
          integration.environment === environment,
      ),
  );
}
