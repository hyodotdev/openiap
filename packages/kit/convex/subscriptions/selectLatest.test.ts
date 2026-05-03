import { describe, expect, it } from "vitest";

import { selectMostRecentlyUpdatedSubscription } from "./selectLatest";

describe("selectMostRecentlyUpdatedSubscription", () => {
  it("selects by updatedAt instead of input/index order", () => {
    const selected = selectMostRecentlyUpdatedSubscription([
      { id: "newer-in-index-order", updatedAt: 100, _creationTime: 20 },
      { id: "renewed-later", updatedAt: 300, _creationTime: 10 },
      { id: "middle", updatedAt: 200, _creationTime: 30 },
    ]);

    expect(selected?.id).toBe("renewed-later");
  });

  it("uses creation time as a deterministic tie-breaker", () => {
    const selected = selectMostRecentlyUpdatedSubscription([
      { id: "first", updatedAt: 100, _creationTime: 10 },
      { id: "second", updatedAt: 100, _creationTime: 20 },
    ]);

    expect(selected?.id).toBe("second");
  });

  it("returns null for an empty list", () => {
    expect(selectMostRecentlyUpdatedSubscription([])).toBeNull();
  });
});
