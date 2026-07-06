import { describe, expect, it } from "vitest";

import { nextStateForKitProductUpsert } from "./mutation";

describe("nextStateForKitProductUpsert", () => {
  it("marks edited products as Draft when no explicit state is requested", () => {
    expect(nextStateForKitProductUpsert()).toBe("Draft");
  });

  it("honors explicit state updates", () => {
    expect(nextStateForKitProductUpsert("Active")).toBe("Active");
    expect(nextStateForKitProductUpsert("Removed")).toBe("Removed");
  });
});
