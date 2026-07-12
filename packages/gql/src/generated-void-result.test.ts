import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("generated C# void operations", () => {
  it("uses VoidResult instead of fabricating string payloads", () => {
    const csharp = readFileSync(
      new URL("./generated/Types.cs", import.meta.url),
      "utf8",
    );

    for (const method of [
      "DeepLinkToSubscriptions",
      "FinishTransaction",
      "RestorePurchases",
    ]) {
      expect(csharp).toContain(`Task<VoidResult> ${method}Async(`);
      expect(csharp).not.toContain(`Task<string> ${method}Async(`);
    }
  });
});
