import { describe, expect, it, vi } from "vitest";

import { recordWebhookEvent } from "./internal";

describe("recordWebhookEvent pending-deletion guard", () => {
  for (const pendingOwner of ["project", "organization"] as const) {
    it(`does not recreate webhook rows while the ${pendingOwner} drains`, async () => {
      const rows = new Map<string, Record<string, unknown>>([
        [
          "project_a",
          {
            _id: "project_a",
            organizationId: "organization_a",
            pendingDeletion: pendingOwner === "project",
          },
        ],
        [
          "organization_a",
          {
            _id: "organization_a",
            pendingDeletion: pendingOwner === "organization",
          },
        ],
      ]);
      const insert = vi.fn();
      const ctx = {
        db: {
          get: vi.fn(async (id: string) => rows.get(id) ?? null),
          insert,
        },
      };

      await expect(
        recordWebhookEvent._handler(ctx as never, {
          projectId: "project_a" as never,
          source: "apple",
          sourceNotificationId: "notification_a",
          event: {
            type: "SubscriptionStarted",
            sourceFull: "AppleAppStoreServerNotificationsV2",
            platform: "IOS",
            environment: "Sandbox",
            occurredAt: Date.now(),
          },
        }),
      ).rejects.toThrow("Project not found");
      expect(insert).not.toHaveBeenCalled();
    });
  }
});
